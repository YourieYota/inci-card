using System;
using System.IO;
using System.Linq;
using System.Threading;
using EDSDKWrapper.Framework.Managers;
using EDSDKLib;

internal class Program
{
    // ─── Constantes EDSDK ────────────────────────────────────────────────────
    private const uint kEdsCameraCommand_TakePicture = 0x00000004;
    private const uint kEdsCameraCommand_PressShutterButton = 0x00000004;
    private const uint kEdsCameraCommand_ShutterButton_Completely = 0x00000003;
    private const uint kEdsCameraCommand_ShutterButton_OFF = 0x00000000;

    private static int Main(string[] args)
    {
        var outputDir = ParseOutputDirectory(args);
        var noAf = args.Contains("--noaf") || args.Contains("-na");

        try
        {
            if (args.Contains("-t") || args.Contains("--test"))
                return RunTestCapture(outputDir);

            EnsureNativeSdkPresent();

            Directory.CreateDirectory(outputDir);
            Directory.SetCurrentDirectory(outputDir);

            var count = ParseCount(args);

            using var manager = new FrameworkManager();

            // Énumérer les caméras et capturer l'erreur EDSDK spécifique si OpenSession échoue
            EDSDKWrapper.Framework.Objects.Camera? camera = null;
            try
            {
                camera = manager.Cameras.FirstOrDefault();
            }
            catch (EDSDKWrapper.Framework.Exceptions.EDSDKException edsx)
            {
                // Codes EDSDK fréquents pour OpenSession :
                //   DeviceBusy (0x00000081 = 129) → caméra occupée (PTP mode, autre logiciel)
                //   CommunicationPortIsInUse      → un autre process EDSDK est ouvert
                //   InternalError (2)             → caméra non reconnue / mode USB incorrect
                var code = (uint)edsx.ReturnValue;
                Console.Error.WriteLine($"\n[EDSDK] OpenSession échoué — code 0x{code:X8} ({edsx.ReturnValue})");
                if (code == 0x00000081)
                    Console.Error.WriteLine("→ DeviceBusy : La caméra est en mode PTP (transfert d'images).\n  ✔ Changez le mode USB dans le menu caméra : Menu → 🔧 → Connexion USB → PC Remote");
                else if (code == 0x00000002)
                    Console.Error.WriteLine("→ InternalError : La caméra n'est pas reconnue. Vérifiez le mode USB (PC Remote requis) et rebranchez.");
                else if (code == 0x00002003)
                    Console.Error.WriteLine("→ CommunicationPortIsInUse : Un autre logiciel tient la session (EOS Utility, Lightroom, driver WPD).\n  ✔ Fermez EOS Utility / Lightroom et réessayez.");
                else
                    Console.Error.WriteLine($"→ Autre erreur EDSDK. Vérifiez que le mode USB est 'PC Remote' sur la caméra.");
                return 1;
            }

            if (camera == null)
            {
                Console.Error.WriteLine("Aucun appareil detecte. Verifiez le cable USB et fermez EOS Utility/Lightroom.");
                return 1;
            }

            using (camera)
            {
                Console.WriteLine($"Appareil pret. Lancement de {count} déclenchements...");

                for (int i = 0; i < count; i++)
                {
                    Console.WriteLine($"Declenchement {i + 1}...");

                    // ── Tentative 1 : EdsSendCommand TakePicture (sans AF, sans Live View) ──
                    bool captured = false;
                    try
                    {
                        // Cette commande déclenche directement le mécanisme obturateur
                        // sans passer par l'autofocus
                        uint err = EDSDK.EdsSendCommand(camera.Handle, kEdsCameraCommand_TakePicture, 0);
                        if (err == EDSDK.EDS_ERR_OK)
                        {
                            Console.WriteLine("Capture via EdsSendCommand TakePicture réussie.");
                            captured = true;
                        }
                        else
                        {
                            Console.Error.WriteLine($"EdsSendCommand retourné : 0x{err:X8}, tentative suivante...");
                        }
                    }
                    catch (Exception ex1)
                    {
                        Console.Error.WriteLine($"EdsSendCommand échoué : {ex1.Message}, tentative TakePhoto...");
                    }

                    // ── Tentative 2 : TakePhoto() du wrapper (avec AF) ──
                    if (!captured)
                    {
                        try
                        {
                            camera.TakePhoto();
                            Console.WriteLine("Capture via TakePhoto() réussie.");
                            captured = true;
                        }
                        catch (Exception ex2)
                        {
                            Console.Error.WriteLine($"TakePhoto échoué : {ex2.Message}");
                        }
                    }

                    if (!captured)
                    {
                        Console.Error.WriteLine("Toutes les méthodes de capture ont échoué.");
                        return 1;
                    }

                    // Attendre que la photo soit transférée
                    Thread.Sleep(2000);

                    var savedPath = string.Empty;
                    camera.GetLastPhoto(ref savedPath, 0);

                    var finalPath = Path.IsPathRooted(savedPath) ? savedPath : Path.GetFullPath(savedPath);

                    var targetPath = Path.Combine(outputDir, $"IMG_{DateTime.Now:yyyyMMdd_HHmmss_fff}.JPG");
                    if (!string.Equals(finalPath, targetPath, StringComparison.OrdinalIgnoreCase) && File.Exists(finalPath))
                    {
                        File.Move(finalPath, targetPath, overwrite: true);
                        finalPath = targetPath;
                    }

                    Console.WriteLine($"Photo enregistree ici : {finalPath}");
                    Thread.Sleep(300);
                }
            }

            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Erreur : {ex}");
            return 1;
        }
    }

    private static int RunTestCapture(string outputDir)
    {
        try
        {
            Directory.CreateDirectory(outputDir);
            var targetPath = Path.Combine(outputDir, $"IMG_{DateTime.Now:yyyyMMdd_HHmmss_fff}.JPG");
            // Create a small placeholder file to simulate a capture
            File.WriteAllText(targetPath, "FAUX_JPG: Ceci est un fichier de test de capture.");
            Console.WriteLine($"[TEST] Photo simulée enregistree ici : {targetPath}");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[TEST] Erreur lors de la capture de test : {ex}");
            return 1;
        }
    }

    private static void EnsureNativeSdkPresent()
    {
        var nativeDir = Path.Combine(AppContext.BaseDirectory, "native", "win64");
        var edsdkPath = Path.Combine(nativeDir, "EDSDK.dll");
        var edsImagePath = Path.Combine(nativeDir, "EdsImage.dll");

        if (!File.Exists(edsdkPath) || !File.Exists(edsImagePath))
        {
            throw new InvalidOperationException("Les DLL natives EDSDK.dll et EdsImage.dll sont introuvables dans native/win64.");
        }

        var currentPath = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
        var nativeFull = Path.GetFullPath(nativeDir);
        var alreadyInPath = currentPath
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
            .Select(p => Path.GetFullPath(p))
            .Any(p => string.Equals(p, nativeFull, StringComparison.OrdinalIgnoreCase));

        if (!alreadyInPath)
        {
            Environment.SetEnvironmentVariable("PATH", nativeDir + Path.PathSeparator + currentPath);
        }
    }

    private static string ParseOutputDirectory(string[] args)
    {
        var defaultDir = Path.Combine(AppContext.BaseDirectory, "captures");

        if (args.Length >= 2 && (args[0] == "-o" || args[0] == "--out"))
        {
            return Path.GetFullPath(args[1]);
        }

        return defaultDir;
    }

    private static int ParseCount(string[] args)
    {
        // Look for -n or --count
        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "-n" || args[i] == "--count")
            {
                if (i + 1 < args.Length && int.TryParse(args[i + 1], out var v) && v > 0)
                    return v;
            }
            else if (args[i].StartsWith("--count=", StringComparison.OrdinalIgnoreCase))
            {
                var part = args[i].Substring("--count=".Length);
                if (int.TryParse(part, out var v) && v > 0)
                    return v;
            }
        }

        return 1;
    }
}
