using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using EDSDKWrapper.Framework.Managers;

/// <summary>
/// Serveur de caméra Canon EDSDK : gère Live View + Capture dans une seule session.
///
/// Protocole stdin → stdout :
///   STDIN  "CAPTURE <outputDir>\n"  → déclenche obturateur, enregistre JPEG
///   STDOUT "FRAME:<path>\n"          → chemin du dernier frame live view
///   STDOUT "CAPTURED:<path>\n"       → chemin du JPEG capturé
///   STDOUT "READY\n"                 → caméra prête (après démarrage)
///   STDOUT "ERROR:<msg>\n"           → erreur
///   STDERR ...                       → logs de débogage
/// </summary>
internal class Program
{
    // Répertoire de sortie des frames live view
    static string liveViewDir  = "";
    static string liveFileName = "live.jpg";

    // Synchronisation Live View ↔ Capture
    static volatile bool captureRequested = false;
    static volatile string? captureOutputDir = null;
    static volatile string? lastCapturedPath = null;
    static readonly object captureLock = new();

    private static void EnsureNativeSdkPresent()
    {
        var nativeDir = Path.Combine(AppContext.BaseDirectory, "native", "win64");
        var edsdkPath  = Path.Combine(nativeDir, "EDSDK.dll");
        var edsImgPath = Path.Combine(nativeDir, "EdsImage.dll");

        if (!File.Exists(edsdkPath) || !File.Exists(edsImgPath))
            throw new InvalidOperationException("DLL natives manquantes dans native/win64.");

        var currentPath = Environment.GetEnvironmentVariable("PATH") ?? "";
        var nativeFull = Path.GetFullPath(nativeDir);
        var alreadyInPath = currentPath
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
            .Select(p => Path.GetFullPath(p))
            .Any(p => string.Equals(p, nativeFull, StringComparison.OrdinalIgnoreCase));

        if (!alreadyInPath)
            Environment.SetEnvironmentVariable("PATH", nativeDir + Path.PathSeparator + currentPath);
    }

    private static int Main(string[] args)
    {
        // Parse arguments
        liveViewDir = ParseArg(args, "-o", "--out", Path.Combine(AppContext.BaseDirectory, "liveview"));
        var intervalMs = int.TryParse(ParseArg(args, "-i", "--interval", "200"), out var ms) ? ms : 200;

        try
        {
            EnsureNativeSdkPresent();
            Directory.CreateDirectory(liveViewDir);

            using var manager = new FrameworkManager();
            var camera = manager.Cameras.FirstOrDefault();

            if (camera == null)
            {
                Console.WriteLine("ERROR:Aucun appareil detecte. Verifiez le cable USB et fermez EOS Utility.");
                return 1;
            }

            using (camera)
            {
                Console.WriteLine("READY");
                Console.Error.WriteLine($"[CanonServer] Caméra trouvée. LiveView dir: {liveViewDir}");

                // ── Démarrage du Live View ──
                camera.StartLiveView();
                Thread.Sleep(600); // Laisser le Canon initialiser le flux

                var cts = new CancellationTokenSource();

                // Thread stdin : écoute les commandes "CAPTURE <dir>"
                var stdinThread = new Thread(() =>
                {
                    while (!cts.Token.IsCancellationRequested)
                    {
                        try
                        {
                            var line = Console.In.ReadLine();
                            if (line == null) { cts.Cancel(); break; }
                            line = line.Trim();
                            if (line.StartsWith("CAPTURE", StringComparison.OrdinalIgnoreCase))
                            {
                                var parts = line.Split(' ', 2);
                                var outDir = parts.Length > 1 ? parts[1].Trim() : liveViewDir;
                                lock (captureLock)
                                {
                                    captureOutputDir = outDir;
                                    captureRequested = true;
                                }
                                Console.Error.WriteLine($"[CanonServer] Commande CAPTURE reçue → {outDir}");
                            }
                            else if (line.Equals("QUIT", StringComparison.OrdinalIgnoreCase))
                            {
                                cts.Cancel(); break;
                            }
                        }
                        catch { cts.Cancel(); break; }
                    }
                });
                stdinThread.IsBackground = true;
                stdinThread.Start();

                // ── Boucle principale : Live View + gestion des captures ──
                while (!cts.Token.IsCancellationRequested)
                {
                    try
                    {
                        // Vérifier si une capture est demandée
                        if (captureRequested)
                        {
                            string outDir;
                            lock (captureLock)
                            {
                                outDir = captureOutputDir ?? liveViewDir;
                                captureRequested = false;
                            }

                            // Pause du Live View pour la capture
                            try { camera.StopLiveView(); } catch { }
                            Thread.Sleep(200);

                            // Déclenchement via EdsSendCommand (sans AF)
                            bool captured = false;
                            try
                            {
                                uint err = EDSDKLib.EDSDK.EdsSendCommand(camera.Handle, 0x00000004, 0);
                                if (err == EDSDKLib.EDSDK.EDS_ERR_OK)
                                {
                                    Console.Error.WriteLine("[CanonServer] EdsSendCommand TakePicture OK");
                                    captured = true;
                                }
                                else
                                {
                                    Console.Error.WriteLine($"[CanonServer] EdsSendCommand retourné 0x{err:X8}");
                                }
                            }
                            catch (Exception ex) { Console.Error.WriteLine($"[CanonServer] EdsSendCommand erreur: {ex.Message}"); }

                            // Fallback : TakePhoto avec AF
                            if (!captured)
                            {
                                try { camera.TakePhoto(); captured = true; Console.Error.WriteLine("[CanonServer] TakePhoto OK"); }
                                catch (Exception ex) { Console.Error.WriteLine($"[CanonServer] TakePhoto erreur: {ex.Message}"); }
                            }

                            if (captured)
                            {
                                Thread.Sleep(2000); // Attente transfert

                                Directory.CreateDirectory(outDir);
                                var savedPath = string.Empty;
                                camera.GetLastPhoto(ref savedPath, 0);
                                var finalPath = Path.IsPathRooted(savedPath) ? savedPath : Path.GetFullPath(savedPath);

                                var ts = DateTime.Now.ToString("yyyyMMdd_HHmmss_fff");
                                var targetPath = Path.Combine(outDir, $"IMG_{ts}.JPG");
                                if (!string.Equals(finalPath, targetPath, StringComparison.OrdinalIgnoreCase) && File.Exists(finalPath))
                                {
                                    File.Move(finalPath, targetPath, overwrite: true);
                                    finalPath = targetPath;
                                }

                                lastCapturedPath = finalPath;
                                Console.WriteLine($"CAPTURED:{finalPath}");
                                Console.Error.WriteLine($"[CanonServer] Photo enregistrée : {finalPath}");
                            }
                            else
                            {
                                Console.WriteLine("ERROR:Capture échouée (toutes méthodes épuisées)");
                            }

                            // Reprendre le Live View
                            try
                            {
                                camera.StartLiveView();
                                Thread.Sleep(400);
                            }
                            catch (Exception ex) { Console.Error.WriteLine($"[CanonServer] Reprise live view: {ex.Message}"); }

                            continue; // Repartir en début de boucle
                        }

                        // ── Frame Live View normal ──
                        using var stream = camera.GetLiveViewImage();
                        var destPath = Path.Combine(liveViewDir, liveFileName);

                        // Écriture atomique : temp → rename
                        var tmpPath = destPath + ".tmp";
                        using (var fs = File.Create(tmpPath))
                            stream.CopyTo(fs);

                        File.Move(tmpPath, destPath, overwrite: true);

                        Console.WriteLine($"FRAME:{destPath}");
                        Thread.Sleep(intervalMs);
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine($"[CanonServer] Boucle erreur: {ex.Message}");
                        Thread.Sleep(500);
                    }
                }

                try { camera.StopLiveView(); } catch { }
                Console.Error.WriteLine("[CanonServer] Arrêt propre.");
            }

            return 0;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR:{ex.Message}");
            Console.Error.WriteLine($"[CanonServer] FATAL: {ex}");
            return 1;
        }
    }

    private static string ParseArg(string[] args, string shortFlag, string longFlag, string defaultVal)
    {
        for (int i = 0; i < args.Length - 1; i++)
        {
            if (args[i] == shortFlag || args[i] == longFlag)
                return args[i + 1];
        }
        return defaultVal;
    }
}
