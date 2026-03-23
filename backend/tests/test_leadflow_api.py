"""
LeadFlow AI Backend API Tests - Iteration 3
Tests: Auth, Leads CRUD, Drafts, AI endpoints, User Settings
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = "http://localhost:8001"

TEST_EMAIL = f"test_iter3_{int(time.time())}@example.com"
TEST_PASSWORD = "TestPass123!"
TEST_NAME = "Test User Iter3"


# ─── Fixtures ────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def auth_token():
    """Register a new test user and return the JWT token"""
    # Register
    resp = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "full_name": TEST_NAME,
    })
    assert resp.status_code == 200, f"Registration failed: {resp.text}"
    data = resp.json()
    assert "token" in data, f"No token in register response: {data}"
    return data["token"]


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    """Return auth headers with Bearer token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json",
    }


@pytest.fixture(scope="session")
def created_lead_id(auth_headers):
    """Create a lead for testing and return its ID"""
    resp = requests.post(f"{BASE_URL}/api/leads", json={
        "name": "TEST_Lead Alpha",
        "email": "TEST_lead_alpha@example.com",
        "job_title": "CTO",
        "company": "TEST Corp",
        "signal_category": "manual",
        "ai_score": 2,
    }, headers=auth_headers)
    assert resp.status_code == 200, f"Lead create failed: {resp.text}"
    data = resp.json()
    assert "id" in data
    return data["id"]


# ─── Health ───────────────────────────────────────────────────────────────────────

class TestHealth:
    """Health check endpoints"""

    def test_health_check(self):
        resp = requests.get(f"{BASE_URL}/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") == "healthy"

    def test_health_returns_service_name(self):
        resp = requests.get(f"{BASE_URL}/api/health")
        data = resp.json()
        assert "service" in data or "status" in data


# ─── Auth ─────────────────────────────────────────────────────────────────────────

class TestAuth:
    """Authentication endpoint tests"""

    def test_register_new_user(self):
        unique_email = f"test_reg_{uuid.uuid4().hex[:8]}@example.com"
        resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "full_name": "Reg Test User",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == unique_email

    def test_login_valid_credentials(self):
        # Use the session test user (must register first)
        reg_resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"test_login_{uuid.uuid4().hex[:8]}@example.com",
            "password": TEST_PASSWORD,
            "full_name": "Login Test",
        })
        email = reg_resp.json()["user"]["email"]
        
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": TEST_PASSWORD,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert isinstance(data["token"], str) and len(data["token"]) > 10

    def test_login_invalid_credentials(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "WrongPass999!",
        })
        assert resp.status_code in [401, 400, 422]

    def test_get_me_with_valid_token(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "email" in data
        assert data["email"] == TEST_EMAIL

    def test_get_me_without_token_returns_401(self):
        resp = requests.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code in [401, 403, 422]


# ─── Leads ────────────────────────────────────────────────────────────────────────

class TestLeads:
    """Leads CRUD endpoint tests"""

    def test_list_leads_returns_array(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/leads", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_get_lead_stats(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/leads/stats", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "total_leads" in data
        assert "hot_leads" in data
        assert "contacted" in data
        assert "replies" in data
        assert isinstance(data["total_leads"], int)

    def test_create_lead(self, auth_headers):
        resp = requests.post(f"{BASE_URL}/api/leads", json={
            "name": "TEST_Create Lead",
            "email": "TEST_create_lead@example.com",
            "job_title": "VP Sales",
            "company": "TEST Company Inc",
            "signal_category": "manual",
            "ai_score": 3,
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert data["name"] == "TEST_Create Lead"
        assert data["ai_score"] == 3
        assert data["signal_category"] == "manual"

    def test_create_lead_and_verify_in_list(self, auth_headers):
        # Create
        create_resp = requests.post(f"{BASE_URL}/api/leads", json={
            "name": "TEST_Verify Lead",
            "email": "TEST_verify_lead@example.com",
            "job_title": "Engineer",
            "company": "TEST Verify Corp",
            "signal_category": "manual",
            "ai_score": 2,
        }, headers=auth_headers)
        assert create_resp.status_code == 200
        lead_id = create_resp.json()["id"]

        # Verify in list
        list_resp = requests.get(f"{BASE_URL}/api/leads", headers=auth_headers)
        assert list_resp.status_code == 200
        ids = [l["id"] for l in list_resp.json()]
        assert lead_id in ids

    def test_update_lead_fit_status(self, auth_headers, created_lead_id):
        resp = requests.patch(f"{BASE_URL}/api/leads/{created_lead_id}", json={
            "fit_status": "good",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data or "id" in data

    def test_update_lead_ai_score(self, auth_headers, created_lead_id):
        resp = requests.patch(f"{BASE_URL}/api/leads/{created_lead_id}", json={
            "ai_score": 3,
        }, headers=auth_headers)
        assert resp.status_code == 200

    def test_update_nonexistent_lead_returns_404(self, auth_headers):
        resp = requests.patch(f"{BASE_URL}/api/leads/nonexistent_id_xyz", json={
            "fit_status": "good",
        }, headers=auth_headers)
        assert resp.status_code == 404

    def test_leads_without_auth_returns_401(self):
        resp = requests.get(f"{BASE_URL}/api/leads")
        assert resp.status_code in [401, 403, 422]


# ─── Drafts ───────────────────────────────────────────────────────────────────────

class TestDrafts:
    """Outreach drafts endpoint tests"""

    def test_list_drafts_returns_array(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/drafts", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_list_drafts_without_auth(self):
        resp = requests.get(f"{BASE_URL}/api/drafts")
        assert resp.status_code in [401, 403, 422]


# ─── Signals ─────────────────────────────────────────────────────────────────────

class TestSignals:
    """Signal agents endpoint tests"""

    def test_list_signals_returns_array(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/signals", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_create_signal(self, auth_headers):
        resp = requests.post(f"{BASE_URL}/api/signals", json={
            "name": "TEST_Signal Agent",
            "trigger_type": "linkedin_engagement",
            "icp_description": "B2B SaaS founders",
        }, headers=auth_headers)
        assert resp.status_code in [200, 201]
        data = resp.json()
        assert "id" in data
        assert data["name"] == "TEST_Signal Agent"
        return data["id"]


# ─── AI Endpoints ─────────────────────────────────────────────────────────────────

class TestAIEndpoints:
    """AI chat and insights endpoint tests"""

    def test_get_insights_returns_array(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/ai/insights", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "insights" in data
        assert isinstance(data["insights"], list)
        assert "date" in data

    def test_get_insights_structure(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/ai/insights", headers=auth_headers)
        data = resp.json()
        # Insights should have at least 1 item
        assert len(data["insights"]) >= 1
        # Each insight should have required fields
        for ins in data["insights"]:
            assert "type" in ins
            assert "title" in ins
            assert "body" in ins
            assert ins["type"] in ["insight", "warning", "opportunity", "action"]

    def test_ai_chat_returns_reply(self, auth_headers):
        resp = requests.post(f"{BASE_URL}/api/ai/chat", json={
            "message": "How many leads do I have?",
            "history": [],
        }, headers=auth_headers)
        # Could be 200 (with reply) or 503 (if Anthropic not configured)
        assert resp.status_code in [200, 503]
        if resp.status_code == 200:
            data = resp.json()
            assert "reply" in data
            assert isinstance(data["reply"], str)
            assert len(data["reply"]) > 0

    def test_ai_chat_without_auth(self):
        resp = requests.post(f"{BASE_URL}/api/ai/chat", json={
            "message": "Hello",
        })
        assert resp.status_code in [401, 403, 422]

    def test_ai_insights_without_auth(self):
        resp = requests.get(f"{BASE_URL}/api/ai/insights")
        assert resp.status_code in [401, 403, 422]

    def test_generate_insights_endpoint(self, auth_headers):
        resp = requests.post(f"{BASE_URL}/api/ai/insights/generate", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "insights" in data
        assert isinstance(data["insights"], list)


# ─── User Settings ────────────────────────────────────────────────────────────────

class TestUserSettings:
    """User settings endpoint tests"""

    def test_get_user_settings_returns_keys(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/user/settings", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "trigify_api_key" in data
        assert "unipile_api_key" in data
        assert "netrows_api_key" in data

    def test_post_user_settings_saves_data(self, auth_headers):
        resp = requests.post(f"{BASE_URL}/api/user/settings", json={
            "trigify_api_key": "test-trigify-key-12345",
            "unipile_api_key": "test-unipile-key-12345",
            "netrows_api_key": "test-netrows-key-12345",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data

    def test_get_settings_after_save_returns_masked(self, auth_headers):
        # Save first
        requests.post(f"{BASE_URL}/api/user/settings", json={
            "trigify_api_key": "test-trigify-12345",
        }, headers=auth_headers)
        # Then get
        resp = requests.get(f"{BASE_URL}/api/user/settings", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        # Should be masked (not empty, not full key)
        assert data["trigify_api_key"] != ""
        # Masked format: first 4 chars + asterisks
        assert "*" in data["trigify_api_key"]

    def test_user_settings_without_auth(self):
        resp = requests.get(f"{BASE_URL}/api/user/settings")
        assert resp.status_code in [401, 403, 422]

    def test_post_settings_without_auth(self):
        resp = requests.post(f"{BASE_URL}/api/user/settings", json={
            "trigify_api_key": "test_key",
        })
        assert resp.status_code in [401, 403, 422]

    def test_get_api_keys_status(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/user/api-keys/status", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "trigify_configured" in data
        assert "unipile_configured" in data
        assert "netrows_configured" in data
