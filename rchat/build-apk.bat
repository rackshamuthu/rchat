@echo off
echo ========================================================
echo   Building Rchat Android APK (by Sumis)
echo ========================================================

cd android
if exist gradlew.bat (
    call gradlew.bat assembleDebug
) else (
    echo Gradle wrapper not found. Running gradle assembleDebug...
    call gradle assembleDebug
)

if exist app\build\outputs\apk\debug\app-debug.apk (
    echo.
    echo ========================================================
    echo   SUCCESS! Rchat APK generated at:
    echo   android\app\build\outputs\apk\debug\app-debug.apk
    echo ========================================================
    copy app\build\outputs\apk\debug\app-debug.apk ..\Rchat-Sumis.apk
    echo Copied to root as: Rchat-Sumis.apk
) else (
    echo.
    echo Could not find Android SDK locally.
    echo You can use GitHub Actions (push to GitHub) to build the APK online automatically!
)
pause
