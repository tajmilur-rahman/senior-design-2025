import os

DB = {
    "dbname": "bugbug_data",
    "user": "postgres",
    "password": "2331",
    "host": "127.0.0.1",
    "port": "5432"
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ML_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "ml_training"))
COMPANY_MODELS_DIR = os.path.join(BASE_DIR, "models")

ART_RF = {
    "model": os.path.join(ML_DIR, "rf_model.pkl"),
    "vec":   os.path.join(ML_DIR, "tfidf_vectorizer.pkl"),
    "enc":   os.path.join(ML_DIR, "label_encoders.pkl"),
    "met":   os.path.join(ML_DIR, "rf_metrics.json"),
}


def get_artifact_paths(company_id=None) -> dict:
    if company_id is None or company_id == "global":
        return ART_RF
    company_dir = os.path.join(COMPANY_MODELS_DIR, f"company_{company_id}")
    return {
        "model": os.path.join(company_dir, "rf_model.pkl"),
        "vec":   os.path.join(company_dir, "tfidf_vectorizer.pkl"),
        "enc":   os.path.join(company_dir, "label_encoders.pkl"),
        "met":   os.path.join(company_dir, "rf_metrics.json"),
    }


def company_model_exists(company_id) -> bool:
    paths = get_artifact_paths(company_id)
    return os.path.exists(paths["model"]) and os.path.exists(paths["vec"])

META = ["component", "product", "priority", "platform", "op_sys", "type", "resolution", "status"]
FLAGS = ["has_crash", "is_accessibility", "is_regression", "is_intermittent", "has_patch"]
TOP_SEV = ["S1", "S2", "S3", "S4"]

CATEGORY_TABLE = {
    "Networking & Security": ["network", "connect", "ssl", "tls", "certificate", "security", "vulnerability", "auth", "breach"],
    "Performance & Resource Management": ["slow", "lag", "freeze", "hang", "resource", "memory", "cpu", "performance"],
    "UI/UX & Accessibility": ["ui", "interface", "button", "navigation", "layout", "ux", "accessibility", "a11y"],
    "Compatibility & Web Standards": ["compat", "standard", "render", "html", "css", "js", "cross-platform"],
    "Privacy & User Data": ["privacy", "data", "tracking", "storage", "personal"],
    "Media, Extensions, & Plugins": ["audio", "video", "media", "extension", "plugin"],
    "Installation, Updates, & User Preferences": ["install", "update", "patch", "preference", "settings"],
    "Developer Tools & Debugging": ["devtools", "debug", "javascript", "console", "inspector"],
    "File Handling & System Interaction": ["file", "download", "upload", "filesystem"],
    "Session Management & Synchronization": ["session", "sync", "account", "login", "state"]
}

COMPONENT_CATEGORY_MAP = {
    "Networking": "Networking & Security", "Necko": "Networking & Security",
    "Security: PSM": "Networking & Security", "Performance": "Performance & Resource Management",
    "DOM: Performance": "Performance & Resource Management", "JavaScript Engine": "Performance & Resource Management",
    "UI Widgets": "UI/UX & Accessibility", "Theme": "UI/UX & Accessibility",
    "Accessibility": "UI/UX & Accessibility", "Layout": "Compatibility & Web Standards",
    "DOM": "Compatibility & Web Standards", "CSS Parsing": "Compatibility & Web Standards",
    "Storage": "Privacy & User Data", "Permissions": "Privacy & User Data",
    "Audio/Video": "Media, Extensions, & Plugins", "WebRTC": "Media, Extensions, & Plugins",
    "Add-ons Manager": "Media, Extensions, & Plugins", "Installer": "Installation, Updates, & User Preferences",
    "Application Update": "Installation, Updates, & User Preferences", "DevTools": "Developer Tools & Debugging",
    "Inspector": "Developer Tools & Debugging", "Console": "Console: Developer Tools & Debuging",
    "Download Manager": "File Handling & System Interaction", "File Handling": "File Handling & System Interaction",
    "Sync": "Session Management & Synchronization", "Firefox Accounts": "Session Management & Synchronization"
}
