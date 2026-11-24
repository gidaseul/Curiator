"""전시 지식 검색(RAG) 모듈.

작품·챕터 정보를 문서로 쪼개 색인하고, 해설을 만들 때 관련 자료를 찾아 준다.
"""

from rag.documents import Document, documents_from_payload
from rag.store import KnowledgeStore, SearchHit

__all__ = ["Document", "documents_from_payload", "KnowledgeStore", "SearchHit"]
