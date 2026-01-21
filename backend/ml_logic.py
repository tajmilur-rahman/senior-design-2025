import os, json, joblib, numpy as np, pandas as pd
from config import META, FLAGS, ART_RF

def load_pack(s=ART_RF):
    try:
        if not os.path.exists(s['model']):
            print(f"❌ Model not found at {s['model']}")
            return None, None, None, {}
        # print(f"Loading model from: {os.path.abspath(s['model'])}")
        return joblib.load(s["model"]), joblib.load(s["vec"]), joblib.load(s["enc"]), json.load(
            open(s["met"])) if os.path.exists(s["met"]) else {}
    except Exception as e:
        print(f"Error loading model: {e}")
        return None, None, None, {}

def predict_internal(sum_text, meta, m, v, e):
    if not all([m, v, e]): return "n/a", pd.DataFrame()

    # Vectorize text
    xt = v.transform([sum_text]).toarray()

    # Vectorize Metadata (Handle unknown categories)
    xm_list = []
    for c in META:
        val = meta.get(c, "n/a")
        encoder = e[c] if isinstance(e, dict) and c in e else e
        if hasattr(encoder, 'classes_') and val in encoder.classes_:
            encoded_val = encoder.transform([val])[0]
        else:
            encoded_val = 0
        xm_list.append(encoded_val)
    xm = np.array(xm_list).reshape(1, -1)

    # Vectorize Flags
    xf = np.array([[meta.get(f, 0) for f in FLAGS]])

    # Combine & Predict
    final_features = np.hstack([xm, xf, xt])
    pro = m.predict_proba(final_features)[0]

    # Decode Label
    sev_enc = e["severity"] if isinstance(e, dict) and "severity" in e else e
    lab = sev_enc.inverse_transform(np.arange(len(pro)))

    return lab[np.argmax(pro)], pd.DataFrame({"Severity": lab, "Probability": pro}).sort_values("Probability",
                                                                                                ascending=False)


# --- 2. API WRAPPER (This is what makes the website work) ---
_loaded_pack = None


def predict_severity(summary: str):
    """Called by the Website API."""
    global _loaded_pack
    if _loaded_pack is None: _loaded_pack = load_pack()

    m, v, e, _ = _loaded_pack
    if not m: return "Error", 0.0

    # Auto-fill metadata with defaults so the model doesn't crash
    dummy_meta = {k: "n/a" for k in META}
    for f in FLAGS: dummy_meta[f] = 0

    try:
        label, df = predict_internal(summary, dummy_meta, m, v, e)
        return label, float(df.iloc[0]["Probability"])
    except Exception as err:
        print(f"Prediction Error: {err}")
        return "Error", 0.0