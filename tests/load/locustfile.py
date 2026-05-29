"""Load test scaffold — run: locust -f tests/load/locustfile.py --host=http://localhost:8080"""
from locust import HttpUser, task, between


class ERPUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        self.client.post("/api/auth/login", json={
            "email": "demo@example.com",
            "password": "demo",
        })

    @task(3)
    def health(self):
        self.client.get("/api/health")

    @task(2)
    def list_invoices(self):
        self.client.get("/api/invoices?page=1&page_size=20")

    @task(1)
    def dashboard(self):
        self.client.get("/api/dashboard/summary")
