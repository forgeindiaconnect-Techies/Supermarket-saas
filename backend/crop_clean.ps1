Add-Type -AssemblyName System.Drawing
$srcImg = "C:\Users\Forgeindiaconnect\.gemini\antigravity\brain\a56cf71a-e1f3-46be-861e-b3f62fc51713\.user_uploaded\media_1795089568047_c431b371.jpg"
$destTmp = "c:\PROJECTS\VMS\super-market-scan\mobile-app\assets\images\delivery-hero-banner.tmp.jpg"
$destFinal = "c:\PROJECTS\VMS\super-market-scan\mobile-app\assets\images\delivery-hero-banner.jpg"
$destFrontend = "c:\PROJECTS\VMS\super-market-scan\frontend\src\assets\delivery-hero-banner.jpg"
$destPublic = "c:\PROJECTS\VMS\super-market-scan\frontend\public\delivery-hero-banner.jpg"

$src = [System.Drawing.Image]::FromFile($srcImg)

# Crop banner strictly: x=4, y=34, w=292, h=56
$rectBanner = New-Object System.Drawing.Rectangle(4, 34, 292, 56)
$bmpBanner = New-Object System.Drawing.Bitmap(292, 56)
$g1 = [System.Drawing.Graphics]::FromImage($bmpBanner)
$g1.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g1.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g1.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g1.DrawImage($src, 0, 0, $rectBanner, [System.Drawing.GraphicsUnit]::Pixel)

$bmpBanner.Save($destTmp, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$g1.Dispose()
$bmpBanner.Dispose()
$src.Dispose()

# Atomic copy
Copy-Item -Path $destTmp -Destination $destFinal -Force
Copy-Item -Path $destTmp -Destination $destFrontend -Force
Copy-Item -Path $destTmp -Destination $destPublic -Force
Remove-Item -Path $destTmp -Force
Write-Output "CROP_34_56_SUCCESS"

