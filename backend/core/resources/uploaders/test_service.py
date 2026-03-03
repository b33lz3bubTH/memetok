import asyncio
import pytest
from datetime import datetime
from core.resources.uploaders.service import UploaderService
from core.resources.uploaders.dtos import UploaderCreateRequest
from core.resources.uploaders.models import Uploader, ApiKey

@pytest.mark.asyncio
async def test_uploader_management_and_api_keys():
    svc = UploaderService()
    
    # 1. Create uploader
    email = f"test_{datetime.now().timestamp()}@example.com"
    uploader, raw_key = await svc.create_uploader(UploaderCreateRequest(email=email, name="Test User"))
    
    assert uploader.email == email
    assert raw_key is not None
    assert raw_key.startswith("mt_")
    
    # 2. Validate API key
    is_valid = await svc.validate_api_key(email, raw_key)
    assert is_valid is True
    
    # 3. Validate binding (mocking claims)
    user_id = "test-user-id"
    is_valid_bound = await svc.validate_api_key(email, raw_key, user_id=user_id)
    assert is_valid_bound is True
    
    # Check if bound
    uploader_bound = await svc.get_uploader_by_email(email)
    assert uploader_bound.userId == user_id
    
    # 4. Revoke key
    new_raw_key = await svc.revoke_api_key(uploader.id)
    assert new_raw_key != raw_key
    
    # Old key should be invalid
    assert await svc.validate_api_key(email, raw_key) is False
    # New key should be valid
    assert await svc.validate_api_key(email, new_raw_key) is True

if __name__ == "__main__":
    asyncio.run(test_uploader_management_and_api_keys())
