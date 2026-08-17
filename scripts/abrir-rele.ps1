# Arranca Relé y abre la página. Pensado para un acceso directo del Escritorio:
# sin escribir nada, sin ventana negra a la vista y sin tener que saber en qué
# rama está el repositorio.
#
# No toca git nunca. Si el árbol está en una rama sin la caja de comprobar, lo
# dice y para, en vez de abrir una app que parece bien y no lo está.

$ErrorActionPreference = 'SilentlyContinue'

$repo = Split-Path -Parent $PSScriptRoot
$url = 'http://localhost:5173/'
$panel = Join-Path $repo 'src\components\PreflightPanel.tsx'

function Show-Aviso($mensaje) {
    (New-Object -ComObject WScript.Shell).Popup($mensaje, 0, 'Relé', 48) | Out-Null
}

function Test-Lista {
    try {
        return (Invoke-WebRequest -Uri $url -TimeoutSec 2 -UseBasicParsing).StatusCode -eq 200
    } catch {
        return $false
    }
}

if (-not (Test-Path $panel)) {
    $rama = (& git -C $repo rev-parse --abbrev-ref HEAD)
    Show-Aviso "El repositorio está en la rama '$rama', que no tiene la caja de comprobar.`n`nCambia a main y vuelve a intentarlo."
    return
}

# Si ya está corriendo, no se arranca otra vez: solo se abre la página.
if (-not (Test-Lista)) {
    Start-Process -FilePath $env:ComSpec `
        -ArgumentList '/c', 'npm run dev' `
        -WorkingDirectory $repo `
        -WindowStyle Minimized

    $limite = (Get-Date).AddSeconds(120)
    while ((Get-Date) -lt $limite -and -not (Test-Lista)) {
        Start-Sleep -Milliseconds 500
    }
}

if (Test-Lista) {
    Start-Process $url
} else {
    Show-Aviso "Relé no ha llegado a arrancar en dos minutos.`n`nMira la ventana minimizada de la barra de tareas para ver qué ha fallado."
}
