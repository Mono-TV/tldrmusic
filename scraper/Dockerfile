# TLDR Music Scraper - Cloud Run Job
FROM mcr.microsoft.com/playwright/python:v1.49.0-jammy

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir aiohttp requests

# Copy scraper code
COPY . .

# Install Playwright browsers
RUN playwright install chromium

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Run the scraper job
CMD ["python", "run_job.py"]
