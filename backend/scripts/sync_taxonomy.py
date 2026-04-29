import requests
import json
import os
import logging
import re as _re

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_TAXONOMY_PATH = os.path.abspath(
    os.path.join(BASE_DIR, "..", "..", "frontend", "src", "javascript", "taxonomy.js")
)

BUGZILLA_PRODUCTS = ["Firefox", "Core", "DevTools", "Toolkit", "NSS"]

def _strip_html(text: str) -> str:
    """Remove HTML tags and collapse whitespace from Bugzilla description fields."""
    text = _re.sub(r"<[^>]+>", "", text or "")
    return " ".join(text.split())

FALLBACK_TAXONOMY = {
    "Firefox": {
        "A-M": ["about:logins", "Address Bar", "Bookmarks & History", "Downloads Panel",
                "File Handling", "Firefox Accounts", "General", "Installer", "Keyboard Navigation",
                "Menus", "Messaging System", "Migration"],
        "N-Z": ["New Tab Page", "PDF Viewer", "Performance", "Private Browsing",
                "Screenshots", "Search", "Security", "Session Restore", "Settings UI",
                "Sidebar", "Site Permissions", "Tabs", "Theme"]
    },
    "Core": {
        "A-M": ["CSS Parsing and Computation", "CSS Transitions and Animations",
                "DOM Core", "DOM Events", "Garbage Collection", "Graphics", "HTML Parser",
                "JavaScript Engine", "Layout", "Layout: Flexbox", "Layout: Grid"],
        "N-Z": ["Networking", "Networking: Cache", "Networking: Cookies", "Networking: DNS",
                "Networking: HTTP", "Printing", "Security", "SpiderMonkey", "WASM",
                "Web Audio", "Web Painting", "WebRTC"]
    },
    "DevTools": {
        "A-M": ["Console", "Debugger", "General", "Inspector", "JSON Viewer",
                "Marionette Client and Harness"],
        "N-Z": ["Netmonitor", "Style Editor", "View Source", "geckodriver",
                "web-platform-tests"]
    },
    "Toolkit": {
        "A-M": ["Add-ons Manager", "Application Update", "Autocomplete", "Crash Reporting",
                "Downloads API", "Form Autofill", "General", "mozapps"],
        "N-Z": ["Notifications", "Password Manager", "Places", "Storage",
                "Telemetry", "WebExtensions"]
    },
    "NSS": {
        "A-M": ["Libraries"],
        "N-Z": ["TLS/SSL", "Tools"]
    }
}

FALLBACK_DESCRIPTIONS = {
    "Firefox": "The user-facing Firefox browser interface, including tabs, URL bar, and settings.",
    "Core": "The Gecko rendering engine — HTML/CSS parsing, JavaScript, layout, and networking.",
    "DevTools": "Browser developer tools for debugging, inspecting, and profiling web applications.",
    "Toolkit": "Cross-platform toolkit components used by Firefox and other Mozilla applications.",
    "NSS": "Network Security Services — cryptographic libraries for TLS/SSL and PKI."
}


def fetch_and_build_taxonomy():
    print("📡 [ETL PIPELINE] Connecting to Mozilla Bugzilla REST API...")

    taxonomy_data = {}
    team_descriptions = {}
    failed_products = []

    headers = {"User-Agent": "BugPriorityOS-SeniorDesignProject/1.0"}

    for product_name in BUGZILLA_PRODUCTS:
        try:
            url = (
                f"https://bugzilla.mozilla.org/rest/product?names={product_name}"
                f"&include_fields=name,description,components.name,components.is_active"
            )
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            products = response.json().get("products", [])

            if not products:
                raise ValueError(f"Empty product list for {product_name}")

            product = products[0]
            team_name = product.get("name", product_name)
            team_descriptions[team_name] = _strip_html(product.get("description") or FALLBACK_DESCRIPTIONS.get(product_name, ""))

            buckets = {"A-M": [], "N-Z": []}
            for comp in product.get("components", []):
                comp_name = comp.get("name", "")
                if not comp.get("is_active") or not comp_name:
                    continue
                if comp_name[0].upper() < "N":
                    buckets["A-M"].append(comp_name)
                else:
                    buckets["N-Z"].append(comp_name)

            # Only keep non-empty buckets
            taxonomy_data[team_name] = {k: v for k, v in buckets.items() if v}
            print(f"  ✅ {team_name}: {sum(len(v) for v in taxonomy_data[team_name].values())} components")

        except Exception as e:
            print(f"  ⚠️ {product_name}: {e} — using fallback")
            failed_products.append(product_name)
            taxonomy_data[product_name] = FALLBACK_TAXONOMY.get(product_name, {"A-M": ["General"], "N-Z": []})
            team_descriptions[product_name] = FALLBACK_DESCRIPTIONS.get(product_name, "")

    if failed_products:
        print(f"🔄 [ETL PIPELINE] Used fallback for: {', '.join(failed_products)}")
    else:
        print("✅ [ETL PIPELINE] All products fetched live from Bugzilla!")

    print(f"💾 [ETL PIPELINE] Writing taxonomy to {FRONTEND_TAXONOMY_PATH}")

    team_component_counts = {
        team: sum(len(v) for v in buckets.values())
        for team, buckets in taxonomy_data.items()
    }

    js_content = f"""// AUTO-GENERATED BY BACKEND ETL PIPELINE
// Do not edit manually. Data synchronized directly from Bugzilla REST API.

export const mozillaTaxonomy = {json.dumps(taxonomy_data, indent=2)};

export const teamDescriptions = {json.dumps(team_descriptions, indent=2)};

export const teamComponentCounts = {json.dumps(team_component_counts, indent=2)};
"""
    os.makedirs(os.path.dirname(FRONTEND_TAXONOMY_PATH), exist_ok=True)
    with open(FRONTEND_TAXONOMY_PATH, "w", encoding="utf-8") as f:
        f.write(js_content)

    print("✅ [ETL PIPELINE] Frontend Sync Complete!")
    return taxonomy_data


if __name__ == "__main__":
    fetch_and_build_taxonomy()
