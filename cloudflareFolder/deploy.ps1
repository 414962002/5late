# Cloudflare Worker Deployment Script
# Interactive script for downloading/uploading worker code

# Configuration
$ACCOUNT_ID = "***"
$API_TOKEN = "***"
$SCRIPT_NAME = "***"

$baseUrl = "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/scripts/$SCRIPT_NAME"

$headers = @{
    Authorization = "Bearer $API_TOKEN"
}

# Main loop
do {
    # Timestamp for backups
    $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"

    Write-Host ""
    Write-Host "Cloudflare Worker Manager" -ForegroundColor Cyan
    Write-Host "=========================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Choose action:"
    Write-Host "1 - Download Worker from Cloudflare"
    Write-Host "2 - Upload local worker.js to Cloudflare"
    Write-Host "3 - Exit"
    Write-Host ""
    $choice = (Read-Host "Enter 1, 2, or 3").Trim()

    if ($choice -eq "1") {
        # Download worker code
        $backupFile = "worker_backup_$timestamp.js"

        Write-Host ""
        Write-Host "Downloading Worker..." -ForegroundColor Yellow
        
        try {
            Invoke-WebRequest -Method Get -Uri "$baseUrl/content/v2" -Headers $headers -OutFile $backupFile
            Write-Host "Success! Saved as $backupFile" -ForegroundColor Green
        }
        catch {
            Write-Host "Download failed!" -ForegroundColor Red
            Write-Host "Error: $_" -ForegroundColor Red
        }
    }

    elseif ($choice -eq "2") {
        # Upload worker code
        if (!(Test-Path "worker.js")) {
            Write-Host ""
            Write-Host "worker.js not found!" -ForegroundColor Red
            continue
        }

        Write-Host ""
        Write-Host "Uploading worker.js to Cloudflare..." -ForegroundColor Yellow

        try {
            # Read worker content
            $workerContent = Get-Content -Path "worker.js" -Raw -Encoding UTF8

            # Build multipart body manually with correct binary encoding
            $boundary = "----FormBoundary" + [System.Guid]::NewGuid().ToString("N")
            $CRLF = [System.Text.Encoding]::ASCII.GetBytes("`r`n")

            $ms = New-Object System.IO.MemoryStream

            # Metadata part
            $metaPart = [System.Text.Encoding]::ASCII.GetBytes(
                "--$boundary`r`n" +
                "Content-Disposition: form-data; name=`"metadata`"`r`n" +
                "Content-Type: application/json`r`n`r`n" +
                '{"main_module":"index.js"}' + "`r`n"
            )
            $ms.Write($metaPart, 0, $metaPart.Length)

            # Script part
            $scriptHeader = [System.Text.Encoding]::ASCII.GetBytes(
                "--$boundary`r`n" +
                "Content-Disposition: form-data; name=`"index.js`"; filename=`"index.js`"`r`n" +
                "Content-Type: application/javascript+module`r`n`r`n"
            )
            $ms.Write($scriptHeader, 0, $scriptHeader.Length)

            $scriptBody = [System.Text.Encoding]::UTF8.GetBytes($workerContent)
            $ms.Write($scriptBody, 0, $scriptBody.Length)

            $closing = [System.Text.Encoding]::ASCII.GetBytes("`r`n--$boundary--`r`n")
            $ms.Write($closing, 0, $closing.Length)

            $bodyBytes = $ms.ToArray()
            $ms.Dispose()

            $response = Invoke-RestMethod -Uri $baseUrl -Method Put -Headers @{
                "Authorization" = "Bearer $API_TOKEN"
                "Content-Type"  = "multipart/form-data; boundary=$boundary"
            } -Body $bodyBytes

            Write-Host "Worker deployed successfully!" -ForegroundColor Green
            Write-Host "Changes are now live on Cloudflare" -ForegroundColor Green
        }
        catch {
            Write-Host "Upload failed!" -ForegroundColor Red
            Write-Host "Error: $_" -ForegroundColor Red
        }
    }

    elseif ($choice -eq "3") {
        Write-Host ""
        Write-Host "Exiting..." -ForegroundColor Gray
        break
    }

    else {
        Write-Host ""
        Write-Host "Invalid choice. Please enter 1, 2, or 3." -ForegroundColor Red
    }

} while ($true)

Write-Host ""


