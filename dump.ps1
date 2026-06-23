$asm = [Reflection.Assembly]::LoadFrom("F:\inci-card\SDK CANON\liveview ok\bin\Release\net8.0\win-x64\EDSDKWrapper.Framework.dll")
$type = $asm.GetType("EDSDKWrapper.Framework.Camera")
if ($null -eq $type) { $type = $asm.GetType("EDSDKWrapper.Framework.Managers.Camera") }
$type.GetEvents() | Select-Object Name | Out-File events.txt
$type.GetProperties() | Select-Object Name, PropertyType | Out-File props.txt
$type.GetMethods() | Select-Object Name | Out-File methods.txt
