@echo off
echo Redemarrage du service INCI-Card-App...
net start INCI-Card-App
if %errorLevel% equ 0 (
    echo Service demarre ! Ouvrez http://localhost:3000
    echo Identifiant: admin  /  Mot de passe: admin123
) else (
    echo Erreur au demarrage du service.
)
pause
