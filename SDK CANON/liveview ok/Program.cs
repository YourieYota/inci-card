using System;
using System.IO;
using System.Linq;
using System.Threading;
using EDSDKWrapper.Framework.Managers;
using EDSDKWrapper.Framework.Enums;
using EDSDKLib;

class Program {
    private static void EnsureNativeSdkPresent() {
        var nativeDir = Path.Combine(AppContext.BaseDirectory, "native", "win64");
        var currentPath = Environment.GetEnvironmentVariable("PATH") ?? "";
        if (!currentPath.Contains(nativeDir, StringComparison.OrdinalIgnoreCase)) {
            Environment.SetEnvironmentVariable("PATH", nativeDir + Path.PathSeparator + currentPath);
        }
    }
    
    static void Main(string[] args) {
        EnsureNativeSdkPresent();
        
        if (args.Length >= 2 && args[0] == "--capture") {
            string outDir = args[1];
            try {
                FrameworkManager manager = null;
                EDSDKWrapper.Framework.Objects.Camera camera = null;
                int initRetries = 6;
                for (int r = 1; r <= initRetries; r++) {
                    try {
                        manager = new FrameworkManager();
                        camera = manager.Cameras.FirstOrDefault();
                        if (camera != null) break;
                        
                        manager.Dispose();
                        manager = null;
                    } catch (Exception ex) {
                        Console.WriteLine($"DEBUG: Capture initialization attempt {r} failed: {ex.Message}. Retrying in 500ms...");
                        if (manager != null) {
                            try { manager.Dispose(); } catch {}
                            manager = null;
                        }
                    }
                    if (r < initRetries) Thread.Sleep(500);
                }

                if (camera == null) {
                    Console.WriteLine("ERROR: Aucune caméra détectée pour la capture (après plusieurs essais).");
                    return;
                }

                using (manager) {
                    using (camera) {
                        Directory.CreateDirectory(outDir);
                        
                        // Diagnostic prints
                        try {
                            Console.WriteLine($"DEBUG: Camera Product Name: {camera.ProductName}");
                            Console.WriteLine($"DEBUG: Camera AE Mode: {camera.AEMode}");
                            Console.WriteLine($"DEBUG: Camera Battery Level: {camera.BatteryLevel}");
                            Console.WriteLine($"DEBUG: Camera Lens Attached: {camera.LensAttached}");
                            Console.WriteLine($"DEBUG: Camera Live View Enabled: {camera.LiveViewEnabled}");
                            Console.WriteLine($"DEBUG: Camera SaveTo Setting: {camera.SaveTo}");
                        } catch (Exception ex) {
                            Console.WriteLine("DEBUG: Failed to read diagnostic properties: " + ex.Message);
                        }
                        
                        // Set the camera save destination to save to the memory card (SaveTo.Camera).
                        // Since this is process-isolated, we do not suffer from the EDSDK caching bug.
                        try {
                            camera.SaveTo = SaveTo.Camera;
                        } catch (Exception ex) {
                            Console.WriteLine("DEBUG: Failed to set SaveTo.Camera, using default. " + ex.Message);
                        }
                        camera.ImageSaveDirectory = outDir;
                        
                        // Clear the capacity to avoid error codes
                        var capacity = new EDSDK.EdsCapacity {
                            NumberOfFreeClusters = 0x7FFFFFFF,
                            BytesPerSector = 512,
                            Reset = 1
                        };
                        EDSDK.EdsSetCapacity(camera.Handle, capacity);

                        // Force stop Live View to ensure the camera mirror is down and ready to capture
                        try {
                            Console.WriteLine("DEBUG: Stopping Live View inside capture process...");
                            camera.StopLiveView();
                        } catch (Exception ex) {
                            Console.WriteLine("DEBUG: StopLiveView exception (can be ignored): " + ex.Message);
                        }
                        Thread.Sleep(500); // Give the mirror time to flip down

                        try {
                            string savedPath = string.Empty;
                            Console.WriteLine("DEBUG: Querying last photo from camera SD card...");
                            camera.GetLastPhoto(ref savedPath, 0);
                            
                            if (!string.IsNullOrEmpty(savedPath)) {
                                string finalPath = Path.IsPathRooted(savedPath) ? savedPath : Path.GetFullPath(savedPath);
                                Console.WriteLine($"DEBUG: GetLastPhoto returned: {finalPath}");
                                
                                if (File.Exists(finalPath)) {
                                    // Move to target name in outDir
                                    string ts = DateTime.Now.ToString("yyyyMMdd_HHmmss_fff");
                                    string targetPath = Path.Combine(outDir, $"IMG_{ts}.JPG");
                                    File.Move(finalPath, targetPath, true);
                                    Console.WriteLine("CAPTURED:" + targetPath);
                                } else {
                                    Console.WriteLine($"ERROR: File returned by GetLastPhoto does not exist on disk: {finalPath}");
                                }
                            } else {
                                Console.WriteLine("ERROR: GetLastPhoto returned empty path.");
                            }
                        } catch (Exception ex) {
                            Console.WriteLine("ERROR: Exception while getting last photo: " + ex.Message);
                        }
                    }
                }
            } catch (Exception ex) {
                Console.WriteLine("ERROR: Exception dans Main capture: " + ex.Message);
            }
            return;
        }

        // --- Mode Live View ---
        string liveViewDir = args.Length > 1 && args[0] == "-o" ? args[1] : Path.Combine(AppContext.BaseDirectory, "liveview");
        Directory.CreateDirectory(liveViewDir);
        
        var cts = new CancellationTokenSource();
        var stdinThread = new Thread(() => {
            while (true) {
                var line = Console.ReadLine();
                if (line == null || line.Trim().Equals("QUIT", StringComparison.OrdinalIgnoreCase)) {
                    cts.Cancel();
                    break;
                }
            }
        });
        stdinThread.IsBackground = true;
        stdinThread.Start();

        try {
            FrameworkManager manager = null;
            EDSDKWrapper.Framework.Objects.Camera camera = null;
            int initRetries = 6;
            for (int r = 1; r <= initRetries; r++) {
                try {
                    manager = new FrameworkManager();
                    camera = manager.Cameras.FirstOrDefault();
                    if (camera != null) break;
                    
                    manager.Dispose();
                    manager = null;
                } catch (Exception ex) {
                    Console.Error.WriteLine($"[CanonServer] Initialisation Live View essai {r} échoué: {ex.Message}. Retentative dans 500ms...");
                    if (manager != null) {
                        try { manager.Dispose(); } catch {}
                        manager = null;
                    }
                }
                if (r < initRetries) Thread.Sleep(500);
            }

            if (camera == null) {
                Console.Error.WriteLine("[CanonServer] Aucune caméra trouvée (après plusieurs essais).");
                return;
            }

            using (manager) {
                using (camera) {
                Console.Error.WriteLine("[CanonServer] Démarrage du Live View...");
                try {
                    camera.StartLiveView();
                } catch (Exception ex) {
                    Console.Error.WriteLine("[CanonServer] Impossible de démarrer le Live View: " + ex.Message);
                    return;
                }

                Console.WriteLine("READY");
                Console.Error.WriteLine("[CanonServer] Live View démarré avec succès.");
                
                int consecutiveErrors = 0;
                while (!cts.Token.IsCancellationRequested) {
                    try {
                        using var stream = camera.GetLiveViewImage();
                        var dest = Path.Combine(liveViewDir, "live.jpg");
                        var tmp = dest + ".tmp";
                        using (var fs = File.Create(tmp)) stream.CopyTo(fs);
                        File.Move(tmp, dest, true);
                        Console.WriteLine("FRAME:" + dest);
                        consecutiveErrors = 0;
                    } catch (Exception ex) {
                        consecutiveErrors++;
                        Console.Error.WriteLine($"[CanonServer] Erreur FRAME ({consecutiveErrors}): " + ex.Message);
                        if (consecutiveErrors >= 10) {
                            Console.Error.WriteLine("[CanonServer] Trop d'erreurs consécutives de trame. Arrêt du Live View.");
                            break;
                        }
                    }
                    Thread.Sleep(150);
                }
                
                try { camera.StopLiveView(); } catch { }
            }
        }
        } catch (Exception ex) {
            Console.Error.WriteLine("[CanonServer] Erreur critique: " + ex.Message);
        }
    }
}
