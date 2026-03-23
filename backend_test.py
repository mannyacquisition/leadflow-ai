#!/usr/bin/env python3
"""
LeadFlow AI Backend API Testing Suite
Tests all authentication, signals, and leads endpoints with Supabase PostgreSQL
"""
import requests
import json
import sys
from datetime import datetime
from typing import Dict, Any

class LeadFlowAPITester:
    def __init__(self, base_url="http://localhost:8001"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.test_email = None
        self.test_password = "TestPassword123!"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.session = requests.Session()

    def log_test(self, name: str, success: bool, details: str, response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        if response_data:
            result["response_data"] = response_data
        
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {name}: {details}")

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Dict = None, headers: Dict = None, auth_required: bool = False) -> tuple:
        """Run a single API test"""
        url = f"{self.base_url}/api{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if auth_required and self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers)
            elif method == 'PATCH':
                response = self.session.patch(url, json=data, headers=test_headers)

            success = response.status_code == expected_status
            
            try:
                response_json = response.json()
            except:
                response_json = {"raw_response": response.text}

            details = f"Status: {response.status_code}"
            if success:
                details += f", Response: {json.dumps(response_json, indent=2)[:200]}..."
            else:
                details += f", Expected: {expected_status}, Got: {response.status_code}"
                if response_json:
                    details += f", Error: {response_json}"

            self.log_test(name, success, details, response_json if success else None)
            return success, response_json

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_health_endpoints(self):
        """Test basic health and configuration endpoints"""
        print("\n🔍 Testing Health & Configuration Endpoints...")
        
        self.run_test("Health Check", "GET", "/health", 200)
        self.run_test("Environment Status", "GET", "/config/env-status", 200)

    def test_user_registration(self):
        """Test user registration"""
        print("\n🔍 Testing User Registration...")
        
        # Generate unique test user
        timestamp = datetime.now().strftime("%H%M%S")
        self.test_email = f"test_user_{timestamp}@example.com"
        
        registration_data = {
            "email": self.test_email,
            "password": self.test_password,
            "full_name": "Test User"
        }
        
        success, response = self.run_test(
            "User Registration", 
            "POST", 
            "/auth/register", 
            200, 
            data=registration_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            print(f"✅ Registration successful. User ID: {self.user_id}")
            return True
        else:
            print("❌ Registration failed - cannot proceed with authenticated tests")
            return False

    def test_user_login(self):
        """Test user login with existing credentials"""
        print("\n🔍 Testing User Login...")
        
        if not self.test_email:
            print("⚠️  Skipping login test - no registered user")
            return False
        
        login_data = {
            "email": self.test_email,
            "password": self.test_password
        }
        
        success, response = self.run_test(
            "User Login", 
            "POST", 
            "/auth/login", 
            200, 
            data=login_data
        )
        
        if success and 'token' in response:
            self.token = response['token']  # Update token
            print("✅ Login successful")
            return True
        return False

    def test_get_current_user(self):
        """Test getting current user info"""
        print("\n🔍 Testing Get Current User...")
        
        # Test without authentication (should fail)
        self.run_test("Get Current User (No Auth)", "GET", "/auth/me", 401)
        
        # Test with authentication
        if self.token:
            success, response = self.run_test(
                "Get Current User (With Auth)", 
                "GET", 
                "/auth/me", 
                200, 
                auth_required=True
            )
            return success
        return False

    def test_signal_operations(self):
        """Test signal CRUD operations"""
        print("\n🔍 Testing Signal Operations...")
        
        if not self.token:
            print("⚠️  Skipping signal tests - no authentication token")
            return False
        
        # Test listing signals (should be empty initially)
        success, response = self.run_test(
            "List Signals (Empty)", 
            "GET", 
            "/signals", 
            200, 
            auth_required=True
        )
        
        # Test creating a signal
        signal_data = {
            "name": "Test Signal Agent",
            "status": "active",
            "target_job_titles": ["CEO", "CTO"],
            "target_locations": ["San Francisco", "New York"],
            "target_industries": ["Technology", "SaaS"],
            "company_sizes": ["1-10", "11-50"],
            "excluded_keywords": ["spam", "test"],
            "lead_matching_mode": 85,
            "linkedin_page_url": "https://linkedin.com/company/test",
            "linkedin_profile_url": "https://linkedin.com/in/test",
            "track_profile_visitors": True,
            "keywords": [
                {"text": "AI", "track_mode": "All"},
                {"text": "machine learning", "track_mode": "All"}
            ],
            "influencer_urls": ["https://linkedin.com/in/influencer1"],
            "track_top_profiles": True,
            "track_funding_events": False,
            "track_job_changes": True,
            "competitor_urls": ["https://linkedin.com/company/competitor"]
        }
        
        success, response = self.run_test(
            "Create Signal Agent", 
            "POST", 
            "/signals", 
            200, 
            data=signal_data,
            auth_required=True
        )
        
        signal_id = None
        if success and 'id' in response:
            signal_id = response['id']
            print(f"✅ Signal created with ID: {signal_id}")
        
        # Test listing signals again (should have one)
        self.run_test(
            "List Signals (With Data)", 
            "GET", 
            "/signals", 
            200, 
            auth_required=True
        )
        
        # Test updating signal status
        if signal_id:
            self.run_test(
                "Update Signal Status", 
                "PATCH", 
                f"/signals/{signal_id}/status?status=paused", 
                200, 
                auth_required=True
            )
        
        return signal_id is not None

    def test_leads_operations(self):
        """Test leads and stats endpoints"""
        print("\n🔍 Testing Leads Operations...")
        
        if not self.token:
            print("⚠️  Skipping leads tests - no authentication token")
            return False
        
        # Test getting lead stats
        success, response = self.run_test(
            "Get Lead Stats", 
            "GET", 
            "/leads/stats", 
            200, 
            auth_required=True
        )
        
        # Test listing leads
        success, response = self.run_test(
            "List Leads", 
            "GET", 
            "/leads", 
            200, 
            auth_required=True
        )
        
        return True

    def test_error_handling(self):
        """Test error handling scenarios"""
        print("\n🔍 Testing Error Handling...")
        
        # Test invalid endpoints
        self.run_test("Invalid Endpoint", "GET", "/nonexistent", 404)
        
        # Test invalid authentication
        invalid_headers = {'Authorization': 'Bearer invalid_token_here'}
        self.run_test(
            "Invalid Token", 
            "GET", 
            "/auth/me", 
            401, 
            headers=invalid_headers
        )
        
        # Test invalid registration data
        invalid_data = {
            "email": "not-an-email",
            "password": "123"  # Too short
        }
        self.run_test(
            "Invalid Registration Data", 
            "POST", 
            "/auth/register", 
            422, 
            data=invalid_data
        )

    def save_results(self):
        """Save test results to JSON file"""
        results = {
            "timestamp": datetime.now().isoformat(),
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "success_rate": (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0,
            "test_results": self.test_results
        }
        
        with open('/app/test_reports/backend_test_results.json', 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"\n📊 Test Results Saved: {self.tests_passed}/{self.tests_run} tests passed ({results['success_rate']:.1f}%)")

    def run_all_tests(self):
        """Run complete test suite"""
        print("🚀 Starting LeadFlow AI Backend API Tests...")
        print("=" * 60)
        
        # Basic health tests
        self.test_health_endpoints()
        
        # Authentication flow
        registration_success = self.test_user_registration()
        if registration_success:
            self.test_user_login()
            self.test_get_current_user()
            
            # Feature tests (require authentication)
            self.test_signal_operations()
            self.test_leads_operations()
        
        # Error handling
        self.test_error_handling()
        
        # Save results
        self.save_results()
        
        print("\n" + "=" * 60)
        print(f"🏁 Testing Complete: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return 1

def main():
    tester = LeadFlowAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())