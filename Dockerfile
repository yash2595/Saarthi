FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY ["final backend mantrasetu/mantrasetu-saarthi-backend-main/app/requirements.txt", "/app/requirements.txt"]
RUN pip install -r requirements.txt
COPY ["final backend mantrasetu/mantrasetu-saarthi-backend-main/app", "/app/app"]
RUN useradd --create-home --uid 10001 saarthi && \
    mkdir -p /app/uploads && chown -R saarthi:saarthi /app
USER saarthi
EXPOSE 8000
CMD ["sh", "-c", "exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
