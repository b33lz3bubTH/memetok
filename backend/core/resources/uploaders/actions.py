from __future__ import annotations

from enum import Enum


class UploadersQueryAction(str, Enum):
    LIST_UPLOADERS = "list_uploaders"
    GET_UPLOADER = "get_uploader"
    VALIDATE_API_KEY = "validate_api_key"
    GET_MY_ACCESS = "get_my_access"


class UploadersMutationAction(str, Enum):
    CREATE_UPLOADER = "create_uploader"
    UPDATE_UPLOADER_STATUS = "update_uploader_status"
    REVOKE_API_KEY = "revoke_api_key"
