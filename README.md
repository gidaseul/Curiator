# Curiator: 박물관 도슨트 AI

작품 정보를 넣으면 해설 글을 쓰고, 고른 목소리로 읽어 주는 도슨트 API와 화면입니다.
해설은 입력에 있는 정보만 쓰도록 제한했고, 관람객 수준(어린이·일반·전문가)과 언어 5개를 고를 수 있습니다.

숭실대 캡스톤 팀 프로젝트(2025)에서 맡았던 AI 파트를 정리한 저장소입니다.
따로 흩어져 있던 두 저장소(`Curiator`의 해설·음성 API와 `tts`의 RAG 실험)를 하나로 합쳤습니다.

## 무엇을 하나

| 기능 | 설명 |
|---|---|
| 해설 생성 | 작품 하나 또는 챕터(여러 작품 묶음)를 받아 "이야기 중심"과 "역사·정석" 두 가지 해설을 만듭니다 |
| 관람객 수준 | 어린이 / 일반 / 전문가. 말의 난이도만 바꾸고 사실은 더하지 않습니다 |
| 언어 | 한국어, 영어, 일본어, 스페인어, 프랑스어 |
| 음성 | Gemini TTS, 목소리 4종(Adam, Noah, Chloe, Sophie) |
| 전시 지식 검색 (RAG) | 넣어 둔 전시 자료에서 관련 작품·챕터를 찾아 해설에 덧붙입니다 |
| 관람객 질문 | 질문과 관련된 자료를 찾고, 그 자료 안에서만 답합니다. 자료가 없으면 없다고 답합니다 |
| 저장 | 음성을 로컬 또는 S3에 저장합니다 |

## 구조

```mermaid
flowchart LR
    A["작품 / 챕터 JSON"] --> B["입력 해석<br/>museum_source.py"]
    K[("전시 지식 저장소<br/>rag/")] -->|"관련 자료 검색"| C
    B --> C["해설 생성<br/>Gemini · llm/"]
    C --> D["음성 합성<br/>Gemini TTS · tts/"]
    D --> E["로컬 또는 S3"]
    Q["관람객 질문"] --> K
    K -->|"찾은 자료 안에서만"| R["답변 · /ask"]
```

```
main.py                 FastAPI 앱과 엔드포인트
museum_source.py        작품 하나 / 챕터 / 박물관 묶음 입력을 한 가지 형태로 맞춤
llm/                    해설·답변 프롬프트와 Gemini 호출
rag/                    문서 만들기, 임베딩, 검색
tts/                    Gemini TTS, 선택 설치용 오픈소스 음성
data/knowledge/         전시 자료 예시 (JSON)
frontend/               React + Vite 화면 (4단계: 자료 입력, 수준 선택, 글 확인, 음성)
tests/                  외부 API 없이 도는 테스트
```

## 전시 지식 검색이 동작하는 방식

1. 박물관 자료를 작품 문서와 챕터 문서로 쪼갭니다. 문서에는 입력에 있는 필드만 들어갑니다.
2. `GEMINI_API_KEY`가 있으면 Gemini 임베딩으로 벡터를 만들어 뜻이 가까운 문서를 찾습니다.
3. 키가 없거나 호출이 실패하면 글자 2~3개 묶음의 TF-IDF로 대신 찾습니다. 이 방식은 글자가 겹쳐야 찾을 수 있어 뜻 검색은 아닙니다.
4. 점수가 기준보다 낮은 문서는 버립니다. 해설 대상 자신과, 대상이 속한 챕터 문서는 결과에서 뺍니다.

응답의 `references`에 어떤 자료를 어떤 방식(`embedding` 또는 `lexical`)으로 찾았는지 함께 돌려줍니다.

## 실행

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # mp3 변환에 ffmpeg 가 필요합니다
cp .env.example .env                     # GEMINI_API_KEY 를 넣습니다

python scripts/ingest.py                 # data/knowledge 의 자료를 저장소에 넣기
uvicorn main:app --reload                # http://localhost:8000/docs
```

화면:

```bash
cd frontend && npm install && npm run dev
```

목소리 복제(OpenVoice)와 오픈소스 음성(MeloTTS)은 선택 설치입니다. `requirements-voice.txt`를 보세요.
설치하지 않아도 서버는 뜨고, 해당 경로를 부르면 설치되어 있지 않다는 응답(501)이 옵니다.

## API

| 메서드 | 경로 | 하는 일 |
|---|---|---|
| POST | `/generate-text` | 해설 글 두 가지를 만듭니다. `level`, `use_knowledge`를 줄 수 있습니다 |
| POST | `/generate-audio` | 글을 음성으로 만듭니다 |
| POST | `/generate` | 글과 음성을 한 번에 만들고 저장 위치를 돌려줍니다 |
| POST | `/ask` | 관람객 질문에 전시 자료 안에서 답합니다 |
| GET | `/knowledge` | 저장소의 문서 수와 현재 검색 방식 |
| POST | `/knowledge/ingest` | 전시 자료를 저장소에 넣습니다 |
| POST | `/knowledge/search` | 검색 결과만 확인합니다 |
| POST | `/generate-audio-clone` | 올린 목소리로 읽습니다 (선택 설치) |

예시:

```bash
curl -X POST localhost:8000/generate-text -H 'Content-Type: application/json' -d '{
  "artifact": {"artifactId": "PS0100100100100331200000", "nameKr": "금동 반가사유상",
               "nationalityEra": "삼국", "materialPrimary": "금동",
               "desc": "깊은 명상에 잠긴 모습의 반가사유상입니다."},
  "language": "한국어", "level": "child", "use_knowledge": true
}'
```

## 확인한 것과 확인하지 않은 것

| 항목 | 상태 |
|---|---|
| 입력 해석, 문서 만들기, 글자 기반 검색, 저장소 저장·불러오기 | 테스트로 확인 (`pytest`, 외부 API 없음) |
| 수준·참고 자료가 프롬프트와 응답에 전달되는 경로 | 테스트로 확인 (LLM은 가짜로 대체) |
| 화면 타입 검사와 빌드 | `npm run build`로 확인 |
| 합친 뒤의 실제 Gemini 호출(해설, 음성, 임베딩) | 이 저장소 기준으로는 아직 다시 돌려 보지 않았습니다 |
| S3 저장, 오픈소스 음성, 목소리 복제 | 합친 뒤 다시 확인하지 않았습니다 |
| 해설 품질 평가 | 정량 평가가 없습니다 |

```bash
pip install -r requirements-dev.txt && pytest -q
```

## 데이터

`data/knowledge/sample_museum.json`은 형식을 보여 주기 위한 예시입니다.
첫 번째 작품은 국립중앙박물관 소장품의 공개 정보를 바탕으로 했고, `SAMPLE-`로 시작하는 항목은 형식 설명용으로 만든 것입니다.
실제 서비스에서는 박물관 DB에서 받은 작품 정보를 같은 형식으로 넣습니다.

## 합치기 전의 두 저장소

- `Curiator` (2025.11): 해설 생성과 Gemini 음성, S3 저장을 하는 FastAPI. 이 저장소의 뼈대입니다.
- `tts` (2026.04): RAG와 관람객 수준을 실험한 버전. 검색과 수준 개념을 가져왔습니다. Claude 호출과 XTTS 음성 복제는 가져오지 않았습니다.
