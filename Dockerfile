FROM python:3.11-slim as builder
WORKDIR /app
RUN apt-get update && apt-get install -y build-essential libpq-dev
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y libpq-dev && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
ENV PATH=/root/.local/bin:$PATH

COPY . .
ENV PYTHONPATH=/app/backend
EXPOSE 8000

CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "-t", "120", "-w", "1", "-b", "0.0.0.0:8000", "backend.main:app"]