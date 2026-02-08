# Frontend-Backend Sync Setup Guide

## ✅ What's Been Fixed

### 1. **Backend CORS Configuration** ✓
- **Status**: Already configured and working
- **File**: `backend/main.py` (lines 14-19)
- **Config**: 
  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["*"],
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```
- This allows the frontend to make requests from any origin during development

### 2. **Frontend API Integration** ✓ 
Updated components to use real API calls instead of fake data:

#### **Bug Analysis Page** (`frontend/src/pages/BugAnalysis.jsx`)
- ❌ **Before**: Used hardcoded fake data with `setTimeout`
- ✅ **After**: Makes real API calls to:
  - `POST /api/predict` - Get bug severity prediction
  - `GET /api/hub/search_hints` - Find similar past bugs
- Added error handling and loading states

#### **ML Predictor** (`frontend/src/App.jsx`)
- ❌ **Before**: Fell back to fake data if API failed
- ✅ **After**: Shows proper error message directing to backend

#### **Other Components** (Already using real APIs)
- Overview tab: Calls `/api/hub/overview`
- Explorer/Hub: Calls `/api/hub/explorer`
- All use fallback demo data if connection fails (graceful degradation)

### 3. **Configuration Centralization** (`frontend/src/config.js`)
- New centralized config file for all API endpoints
- Supports environment-based URLs via `VITE_API_URL`
- Makes it easy to switch between development and production

## 🚀 How to Run

### **Step 1: Start the Backend**
```bash
cd backend
python -m uvicorn main:app --reload
```
- Server runs on `http://127.0.0.1:8000`
- Check CORS is working by seeing the middleware in startup logs

### **Step 2: Start the Frontend**
```bash
cd frontend
npm install  # (only needed first time)
npm run dev
```
- Frontend runs on `http://127.0.0.1:5173` (default Vite port)

### **Step 3: Test the Connection**
1. Open frontend in browser (typically http://localhost:5173)
2. Go to **Bug Analysis** tab
3. Enter a bug description, e.g.: "Memory leak in authentication service"
4. Click **Analyze** button
5. Should see:
   - ✓ Severity prediction (S1, S2, S3, S4)
   - ✓ Confidence score
   - ✓ Team assignment
   - ✓ Diagnosis 
   - ✓ Similar bugs from database

## 📋 Files Modified

| File | Change |
|------|--------|
| `frontend/src/pages/BugAnalysis.jsx` | Converted to real API calls |
| `frontend/src/App.jsx` | Removed fake data fallback |
| `frontend/src/config.js` | **NEW** - Centralized API configuration |

## 🔧 Troubleshooting

### "Error: Could not connect to backend API"
- Ensure backend is running: `uvicorn main:app --reload`
- Check backend is on `http://127.0.0.1:8000`
- Check browser console for detailed error messages

### CORS Errors in Console
- These should NOT appear! CORS is properly configured
- If you see CORS errors, the backend might not be running

### Components showing fake/demo data
- Overview tab will show demo data if API times out (2-second fallback)
- This is intentional for better UX
- Check backend is running to get real data

## 🌐 Environment Variables (Optional)

Create `frontend/.env` to customize API URL:
```
VITE_API_URL=http://your-backend-domain:8000
```

Default: `http://127.0.0.1:8000`

## ✨ Next Steps

1. ✅ Backend and frontend are now synced
2. Test all components making real API calls
3. Consider adding:
   - Loading skeletons for better UX
   - Retry logic for failed requests
   - API response caching
   - More detailed error messages
