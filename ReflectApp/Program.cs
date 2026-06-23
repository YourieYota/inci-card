using System;
using System.Reflection;
using System.Linq;

class Program {
    static void Main() {
        var asm = Assembly.LoadFrom(@"F:\inci-card\SDK CANON\liveview ok\bin\Release\net8.0\win-x64\EDSDKWrapper.Framework.dll");
        
        var cameraType = asm.GetType("EDSDKWrapper.Framework.Objects.Camera");
        if (cameraType == null) {
            cameraType = asm.GetType("EDSDKWrapper.Framework.Camera");
        }

        if (cameraType != null) {
            Console.WriteLine($"=== Members of {cameraType.FullName} ===");
            Console.WriteLine("--- Properties ---");
            foreach (var p in cameraType.GetProperties(BindingFlags.Public | BindingFlags.Instance)) {
                Console.WriteLine($"{p.PropertyType.Name} {p.Name}");
            }
            Console.WriteLine("--- Events ---");
            foreach (var e in cameraType.GetEvents(BindingFlags.Public | BindingFlags.Instance)) {
                Console.WriteLine($"{e.EventHandlerType?.Name} {e.Name}");
            }
            Console.WriteLine("--- Methods ---");
            foreach (var m in cameraType.GetMethods(BindingFlags.Public | BindingFlags.Instance)) {
                Console.WriteLine($"{m.ReturnType.Name} {m.Name}({string.Join(", ", m.GetParameters().Select(p => p.ParameterType.Name + " " + p.Name))})");
            }
        } else {
            Console.WriteLine("Camera type not found.");
        }
    }
}
