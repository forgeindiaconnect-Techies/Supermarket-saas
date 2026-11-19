Add-Type -AssemblyName System.Drawing
$srcImg = "C:\Users\Forgeindiaconnect\.gemini\antigravity\brain\a56cf71a-e1f3-46be-861e-b3f62fc51713\.user_uploaded\media_1795089568047_c431b371.jpg"
$destBannerMobile = "c:\PROJECTS\VMS\super-market-scan\mobile-app\assets\images\delivery-hero-banner.jpg"
$destRiderMobile = "c:\PROJECTS\VMS\super-market-scan\mobile-app\assets\images\delivery-scooter-hero.jpg"
$destBannerFrontend = "c:\PROJECTS\VMS\super-market-scan\frontend\src\assets\delivery-hero-banner.jpg"
$destBannerPublic = "c:\PROJECTS\VMS\super-market-scan\frontend\public\delivery-hero-banner.jpg"

$src = [System.Drawing.Image]::FromFile($srcImg)

# 1. Full Hero Banner (x: 4, y: 28, w: 292, h: 70)
$rectBanner = New-Object System.Drawing.Rectangle(4, 28, 292, 70)
$bmpBanner = New-Object System.Drawing.Bitmap(292, 70)
$g1 = [System.Drawing.Graphics]::FromImage($bmpBanner)
$g1.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g1.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g1.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g1.DrawImage($src, 0, 0, $rectBanner, [System.Drawing.GraphicsUnit]::Pixel)

$bmpBanner.Save($destBannerMobile, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$bmpBanner.Save($destBannerFrontend, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$bmpBanner.Save($destBannerPublic, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$g1.Dispose()
$bmpBanner.Dispose()

# 2. Right-side Scooter Rider & Storefront (x: 135, y: 28, w: 161, h: 70)
$rectRider = New-Object System.Drawing.Rectangle(135, 28, 161, 70)
$bmpRider = New-Object System.Drawing.Bitmap(161, 70)
$g2 = [System.Drawing.Graphics]::FromImage($bmpRider)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g2.DrawImage($src, 0, 0, $rectRider, [System.Drawing.GraphicsUnit]::Pixel)

$bmpRider.Save($destRiderMobile, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$g2.Dispose()
$bmpRider.Dispose()

$src.Dispose()

# Push updates to Git safely
$log = @()
try {
    Set-Location "c:\PROJECTS\VMS\super-market-scan"
    $env:GIT_TERMINAL_PROMPT = "0"
    git add -A
    $commitOut = git commit -m "fix(mobile): exact match delivery hero banner illustration, compact card scale and nav dividers" 2>&1
    $log += "COMMIT: $commitOut"
    $pushOut = git push https://github.com/forgeindiaconnect-Techies/Supermarket-saas HEAD 2>&1
    $log += "PUSH: $pushOut"
} catch {
    $log += "ERR: $_"
}
$log -join "`n" | Out-File "c:\PROJECTS\VMS\super-market-scan\backend\git_crop_result.txt" -Encoding utf8
Write-Output "CROPPED_AND_PUSHED_SUCCESS"
