import asyncio
from core.resources.uploaders.service import UploaderService

async def main():
    svc = UploaderService()
    uploader_data = await svc.repository.find_by_email("dev-uploader@example.com")
    print(f"Uploader: {uploader_data}")
    valid = await svc.validate_api_key(api_key="mt_nUoQ...", email="dev-uploader@example.com") 
    print(f"Valid: {valid}")

asyncio.run(main())
