$imageDir = Join-Path $PSScriptRoot "assets\\images"
$manifestPath = Join-Path $imageDir "image-manifest.js"
$allowedExtensions = @(".jpg", ".jpeg", ".png", ".webp", ".gif")

$imageFiles = Get-ChildItem -LiteralPath $imageDir -File |
  Where-Object { $allowedExtensions -contains $_.Extension.ToLowerInvariant() } |
  Sort-Object Name

$manifestLines = @("window.IMAGE_SOURCES = [")

foreach ($imageFile in $imageFiles) {
  $manifestLines += "  `"./assets/images/$($imageFile.Name)`","
}

$manifestLines += "];"

Set-Content -LiteralPath $manifestPath -Value $manifestLines -Encoding UTF8
Write-Output "Updated image manifest: $manifestPath"
