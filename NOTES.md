Quick Notes — Don't forget
1) MOST IMPORTANT: Run `main.py` first to populate the database
     python main.py
2) Quick setup (one-time)
   python -m pip install --upgrade pip
   python -m pip install -r requirements.txt
3) 11.20 created .env file that will help us to run train_from_json.py, would generate files, then could run streamlit.app 
The following files are automatically generated when you run the ML training script (train_rf_model_final.py):

File Name	             Description
rf_model.pkl	         Trained Random Forest model for severity prediction
tfidf_vectorizer.pkl	 TF-IDF vectorizer fitted on bug summaries
label_encoders.pkl	     Dictionary of LabelEncoders for metadata fields and severity labels
rf_metrics.json	         Evaluation metrics including accuracy, F1 scores, and confusion matrix

These artifacts are saved in the project directory and are required for the Streamlit UI to function correctly. Make sure to run the training script before launching the app, especially if you’ve updated the dataset or changed model parameters.

4) To generate these files, run:

    python train_rf_model_final.py
    Once complete, you can start the Streamlit app with:

5) streamlit run  streamlit_app.py

