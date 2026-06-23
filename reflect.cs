using System;
using System.Reflection;

class Program {
    static void Main() {
        var asm = Assembly.LoadFrom(@"F:\inci-card\SDK CANON\liveview ok\bin\Release\net8.0\win-x64\EDSDKWrapper.Framework.dll");
        var type = asm.GetType("EDSDKWrapper.Framework.Objects.Camera");
        if (type == null) {
            Console.WriteLine("Camera type not found.");
            return;
        }
        Console.WriteLine("--- EVENTS ---");
        foreach (var ev in type.GetEvents()) {
            Console.WriteLine(ev.Name);
        }
        Console.WriteLine("--- METHODS ---");
        foreach (var m in type.GetMethods()) {
            Console.WriteLine(m.Name);
        }
    }
}
