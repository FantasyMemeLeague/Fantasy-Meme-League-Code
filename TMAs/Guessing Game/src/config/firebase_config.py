import os
from dotenv import load_dotenv
from firebase_admin import credentials, firestore, initialize_app

# Explicitly load the .env from the root level of fantasy-meme-league
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../../.env'))

firebase_config = {
    "type": "service_account",
    "project_id": os.getenv("FIREBASE_PROJECT_ID"),
    "private_key": os.getenv("FIREBASE_PRIVATE_KEY").replace("\\n", "\n"),
    "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
}

cred = credentials.Certificate(firebase_config)
initialize_app(cred)
db = firestore.client()
