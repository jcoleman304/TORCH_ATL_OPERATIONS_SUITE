#!/bin/bash

# TORCH ATL iCloud Sync Setup
# ============================

echo "============================================"
echo "    TORCH ATL iCLOUD SYNC SETUP"
echo "============================================"
echo ""

# iCloud Drive path
ICLOUD_PATH="$HOME/Library/Mobile Documents/com~apple~CloudDocs"
TORCH_ICLOUD="$ICLOUD_PATH/TORCH_ATL_Sync"

# Check if iCloud Drive is available
if [ -d "$ICLOUD_PATH" ]; then
    echo "[OK] iCloud Drive found"
else
    echo "[ERROR] iCloud Drive not found at: $ICLOUD_PATH"
    echo "        Please ensure iCloud Drive is enabled in System Preferences"
    exit 1
fi

# Create TORCH ATL sync folder in iCloud
echo "[1/3] Creating TORCH ATL sync folder in iCloud..."
mkdir -p "$TORCH_ICLOUD"
mkdir -p "$TORCH_ICLOUD/data"
mkdir -p "$TORCH_ICLOUD/backups"
mkdir -p "$TORCH_ICLOUD/exports"
echo "      Created: $TORCH_ICLOUD"

# Create sync configuration
echo "[2/3] Creating sync configuration..."
cat > "$TORCH_ICLOUD/sync-config.json" << EOF
{
    "version": "1.0.0",
    "syncEnabled": true,
    "syncInterval": 300000,
    "dataPath": "$TORCH_ICLOUD/data",
    "backupPath": "$TORCH_ICLOUD/backups",
    "exportPath": "$TORCH_ICLOUD/exports",
    "lastSync": null,
    "deviceId": "$(uuidgen)",
    "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
echo "      Configuration saved"

# Create symlink from Operations Suite to iCloud sync folder
echo "[3/3] Creating sync link..."
SUITE_PATH="$(dirname "$0")"
ln -sf "$TORCH_ICLOUD" "$SUITE_PATH/icloud-data"
echo "      Linked: $SUITE_PATH/icloud-data -> $TORCH_ICLOUD"

echo ""
echo "============================================"
echo "    iCLOUD SYNC SETUP COMPLETE"
echo "============================================"
echo ""
echo "Sync Folder:    $TORCH_ICLOUD"
echo "Local Link:     $SUITE_PATH/icloud-data"
echo ""
echo "Your TORCH ATL data will now sync across all"
echo "devices signed into your iCloud account."
echo ""
echo "To export data manually, open the Operations"
echo "Suite and go to Settings > Export to iCloud"
echo ""
