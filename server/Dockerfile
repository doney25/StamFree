# Use official Python runtime
FROM python:3.11-slim

# Install system dependencies for audio processing
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Download NLTK data at build time to reduce cold start
RUN python -c "import nltk; nltk.download('averaged_perceptron_tagger_eng'); nltk.download('cmudict')"

# Cloud Run provides PORT env var
ENV PORT=8080

# Run with gunicorn - increased timeout to 180s for TensorFlow cold start
CMD exec gunicorn --bind :$PORT --workers 1 --threads 2 --timeout 180 --worker-class gthread app:app
