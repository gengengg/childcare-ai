import io
import json
import os
import re
from pathlib import Path
from typing import List, Optional
from urllib.parse import quote

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Pt
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from lxml import etree
from openai import OpenAI
from pydantic import BaseModel

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

api_key = os.getenv("OPENAI_API_KEY")
model_name = os.getenv("OPENAI_MODEL", "gpt-4o")

client = OpenAI(api_key=api_key, timeout=25.0, max_retries=0)
client_observation = OpenAI(api_key=api_key, timeout=90.0, max_retries=0)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────── 요청 모델 ────────────────

class ActivityItem(BaseModel):
    category: str
    title: str
    memo: Optional[str] = ""


class DailyRecordRequest(BaseModel):
    child_name: str
    class_name: str
    date: str
    activities: List[ActivityItem]
    meal_note: Optional[str] = ""
    nap_note: Optional[str] = ""
    health_note: Optional[str] = ""
    images: Optional[List[str]] = []
    style_guide: Optional[str] = ""
    emoji_enabled: Optional[bool] = True


class StyleSampleItem(BaseModel):
    kind: str  # "text" 또는 "image"
    text: Optional[str] = ""
    image_base64: Optional[str] = ""


class AnalyzeStyleRequest(BaseModel):
    samples: List[StyleSampleItem]


class ObservationActivityItem(BaseModel):
    category: str
    title: str
    memo: Optional[str] = ""


class ObservationSourceRecord(BaseModel):
    date: str
    teacher_final: str
    activities: Optional[List[ObservationActivityItem]] = []
    meal_note: Optional[str] = ""
    nap_note: Optional[str] = ""
    health_note: Optional[str] = ""


class ObservationRequest(BaseModel):
    child_name: str
    class_name: str
    child_age: Optional[int] = 2
    start_date: str
    end_date: str
    child_observation_notes: Optional[str] = ""
    records: List[ObservationSourceRecord]


class ObservationCategories(BaseModel):
    기본생활습관: str
    신체건강: str
    의사소통: str
    사회관계: str
    예술경험: str
    자연탐구: str
    총평: str


class ExportDocxRequest(BaseModel):
    child_name: str
    class_name: str
    observation_date: str
    teacher_name: str
    semester: int
    content: ObservationCategories


# ──────────────── 공통 유틸 ────────────────

def call_openai_text(prompt: str, instructions: str, max_output_tokens: int = 1800) -> str:
    response = client.responses.create(
        model=model_name,
        instructions=instructions,
        input=prompt,
        max_output_tokens=max_output_tokens,
    )
    return response.output_text


def _detect_mime(b64: str) -> str:
    if b64.startswith("/9j/"):
        return "image/jpeg"
    if b64.startswith("iVBORw0KGgo"):
        return "image/png"
    if b64.startswith("UklGR"):
        return "image/webp"
    if b64.startswith("R0lGOD"):
        return "image/gif"
    return "image/jpeg"


def call_openai_with_images(prompt: str, instructions: str, images: List[str], max_output_tokens: int = 1800) -> str:
    if not images:
        return call_openai_text(prompt, instructions, max_output_tokens)

    content = []
    for b64 in images:
        mime = _detect_mime(b64)
        content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:{mime};base64,{b64}",
                "detail": "high",
            },
        })
    content.append({"type": "text", "text": prompt})

    response = client_observation.chat.completions.create(
        model=model_name,
        messages=[
            {"role": "system", "content": instructions},
            {"role": "user", "content": content},
        ],
        max_tokens=max_output_tokens,
    )
    return response.choices[0].message.content


def make_fallback_daily_record(request: DailyRecordRequest) -> str:
    lines = []
    for i, act in enumerate(request.activities, 1):
        lines.append(
            f"{i}. [{act.category}] 활동명: {act.title}\n"
            f"학부모님, 오늘은 {act.title} 활동으로 즐거운 시간을 보냈습니다. "
            f"{request.child_name}이(가) 열심히 참여하는 모습이 무척 대견했습니다."
        )

    daily_notes = []
    if (request.meal_note or "").strip():
        daily_notes.append(f"식사: {request.meal_note.strip()}")
    if (request.nap_note or "").strip():
        daily_notes.append(f"수면: {request.nap_note.strip()}")
    if (request.health_note or "").strip():
        daily_notes.append(f"특이사항: {request.health_note.strip()}")

    result = "\n\n".join(lines)
    if daily_notes:
        result += "\n\n" + " / ".join(daily_notes)
    result += "\n\n행복한 하루 보내세요."
    return result


# ──────────────── docx 생성 유틸 ────────────────

def _set_row_min_height(row, height_emu: int):
    tr = row._tr
    trPr = tr.find(qn("w:trPr"))
    if trPr is None:
        trPr = etree.Element(qn("w:trPr"))
        tr.insert(0, trPr)
    trHeight = trPr.find(qn("w:trHeight"))
    if trHeight is None:
        trHeight = etree.SubElement(trPr, qn("w:trHeight"))
    trHeight.set(qn("w:val"), str(int(height_emu / 635)))
    trHeight.set(qn("w:hRule"), "atLeast")


def _set_cell(cell, text: str, bold=False, center=False, size=11, font="맑은 고딕"):
    para = cell.paragraphs[0]
    para.clear()
    if center:
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = para.add_run(text)
    run.font.name = font
    run.font.size = Pt(size)
    run.font.bold = bold
    rPr = run._r.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = etree.SubElement(rPr, qn("w:rFonts"))
    rFonts.set(qn("w:eastAsia"), font)


def build_observation_docx(req: ExportDocxRequest) -> bytes:
    doc = Document()
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(1.5)
    section.bottom_margin = Cm(1.5)
    section.left_margin = Cm(2.0)
    section.right_margin = Cm(1.5)

    title_para = doc.add_paragraph()
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_para.paragraph_format.space_before = Pt(0)
    title_para.paragraph_format.space_after = Pt(6)
    title_run = title_para.add_run(f"{req.semester}학기  영·유아 관찰평가")
    title_run.font.name = "맑은 고딕"
    title_run.font.size = Pt(16)
    title_run.font.bold = True
    rPr = title_run._r.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = etree.SubElement(rPr, qn("w:rFonts"))
    rFonts.set(qn("w:eastAsia"), "맑은 고딕")

    table = doc.add_table(rows=10, cols=4)
    table.style = "Table Grid"
    col_widths = [Cm(3.0), Cm(4.83), Cm(4.83), Cm(4.84)]
    for row in table.rows:
        for idx, cell in enumerate(row.cells):
            cell.width = col_widths[idx]

    r0 = table.rows[0]
    _set_cell(r0.cells[0], "반  명", bold=True, center=True)
    _set_cell(r0.cells[1], req.class_name, center=True)
    _set_cell(r0.cells[2], "관찰일시", bold=True, center=True)
    _set_cell(r0.cells[3], req.observation_date, center=True)

    r1 = table.rows[1]
    _set_cell(r1.cells[0], "관찰교사", bold=True, center=True)
    merged = r1.cells[1].merge(r1.cells[2]).merge(r1.cells[3])
    _set_cell(merged, f"{req.teacher_name}                               (서명또는 인)")

    r2 = table.rows[2]
    _set_cell(r2.cells[0], "생활영역", bold=True, center=True)
    merged2 = r2.cells[1].merge(r2.cells[2]).merge(r2.cells[3])
    _set_cell(merged2, "관   찰   내   용", bold=True, center=True)

    areas = [
        ("기본생활습관", req.content.기본생활습관),
        ("신체·건강",   req.content.신체건강),
        ("의사소통",    req.content.의사소통),
        ("사회관계",    req.content.사회관계),
        ("예술경험",    req.content.예술경험),
        ("자연탐구",    req.content.자연탐구),
        ("총   평",    req.content.총평),
    ]
    for i, (label, text) in enumerate(areas):
        row = table.rows[3 + i]
        _set_cell(row.cells[0], label, bold=True, center=True, size=10)
        merged = row.cells[1].merge(row.cells[2]).merge(row.cells[3])
        _set_cell(merged, text, size=10)

    _set_row_min_height(table.rows[0], Cm(0.9))
    _set_row_min_height(table.rows[1], Cm(0.9))
    _set_row_min_height(table.rows[2], Cm(0.7))
    for i in range(3, 9):
        _set_row_min_height(table.rows[i], Cm(3.1))
    _set_row_min_height(table.rows[9], Cm(3.6))

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


# ──────────────── 엔드포인트 ────────────────

@app.get("/")
def health_check():
    return {"status": "ok", "message": "childcare-ai backend is running"}


@app.post("/generate-daily-record")
def generate_daily_record(request: DailyRecordRequest):
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY가 설정되지 않았습니다.")

    has_images = bool(request.images)

    # 허용 영역 목록 (표준 보육과정 5영역, 프론트 ACTIVITY_CATEGORIES와 동일)
    VALID_AREAS = {'신체운동·건강', '의사소통', '사회관계', '예술경험', '자연탐구'}

    activities_text = ""
    for i, act in enumerate(request.activities, 1):
        memo = act.memo.strip() if act.memo else "없음"
        cat = act.category.strip() if act.category else ""
        if cat in VALID_AREAS:
            area_line = f"출력 영역(고정): [{cat}]  ← 이 값을 그대로 사용"
        else:
            area_line = (
                "출력 영역(AI 선택 필요): 아래 표준 보육과정 5영역 중 활동명에 맞는 것을 반드시 하나 선택\n"
                "  → 신체운동·건강 / 의사소통 / 사회관계 / 예술경험 / 자연탐구\n"
                "  → 이 목록 외의 어떤 표현도 사용 불가 ([기본생활] [언어·의사소통] [창의·탐구] [놀이] [체험활동] [실내활동] 등 모두 금지)"
            )
        activities_text += f"\n[활동{i}]\n  {area_line}\n  활동명: {act.title}\n  교사 메모: {memo}\n"

    daily_notes = []
    if (request.meal_note or "").strip():
        daily_notes.append(f"식사: {request.meal_note.strip()}")
    if (request.nap_note or "").strip():
        daily_notes.append(f"수면: {request.nap_note.strip()}")
    if (request.health_note or "").strip():
        daily_notes.append(f"특이사항: {request.health_note.strip()}")
    daily_notes_text = ", ".join(daily_notes) if daily_notes else "없음"

    photo_section = ""
    if has_images:
        photo_section = """
[사진 활용 — 최우선 규칙]
첨부된 사진을 먼저 아주 자세히 살펴봐. 마치 학부모가 그 자리에서 아이를 직접 보는 듯한 생생함을 만드는 게 목표야.
- 사진 속 아이의 실제 행동, 손동작, 시선, 표정, 자세, 주변 사물·교구·색깔까지 구체적으로 묘사해.
  예) "싸인펜을 손에 꼭 쥐고", "고개를 갸웃하며 진지하게 들여다보고", "눈을 동그랗게 뜨고", "입을 오물오물하며", "두 손으로 조심스럽게 받쳐 들고"
- 사진에 보이는 교구·재료·색깔·모양을 그대로 언급해 (예: 파란색 바다 매트, 알록달록 물고기 모양 조각, 하얀색 종이, 잠자리채 등).
- 사진에 없는 내용·인물·행동을 절대 만들어내지 마. 추측되는 감정은 사진 속 표정에서 명확히 보일 때만 자연스럽게 한 줄로 덧붙여.
- 활동명·교사 메모는 큰 틀만 참고하고, 구체적인 장면 묘사는 반드시 사진에서 가져와.
"""

    style_guide_text = (request.style_guide or "").strip()
    if style_guide_text:
        style_section = f"""
[사용자 알림장 문체 — 최우선 적용]
이 교사는 평소 자신만의 알림장 문체를 가지고 있어. 아래에 정리된 문체 가이드를 알림장 전체에 자연스럽게 반영해야 해.
이 가이드는 아래의 '문체 규칙' 기본 예시보다 우선해. 단, 표준 보육과정 5영역 규정과 [영역명] 소제목 출력 형식은 절대 바꾸지 마.

{style_guide_text}

위 문체 가이드의 어휘·문장 길이·시작 표현·맺음 표현·즐겨 쓰는 표현·말투(존댓말 정도)·특수문자 사용 여부 등을 그대로 따라가. 단, 학부모를 무시하거나 무례하게 들리는 표현은 사용하지 마.
(이모지 사용 여부는 아래 '이모지 사용 규칙'을 절대적으로 우선해서 따라. 문체 가이드의 이모지 관련 내용은 무시할 것.)
"""
        tone_instructions = (
            "사용자가 기존에 쓰던 알림장 문체 가이드가 입력되어 있다면, 그 문체를 충실히 따라 작성해."
            "기본 문체 규칙(~어요체 80%)은 그 문체 가이드와 충돌할 때 가이드를 우선해."
        )
    else:
        style_section = ""
        tone_instructions = (
            "~어요 체 위주(80% 이상)로 작성하고, ~하십시오·~합니다는 금지하는 기본 문체 규칙을 따라."
        )

    if request.emoji_enabled is False:
        emoji_section = """=== 이모지(이모티콘) 사용 규칙 — 반드시 준수 ===
- 이번 알림장에는 이모지(이모티콘)를 절대 사용하지 마.
- 어떤 영역, 어떤 문장에도 이모지·그림문자·심볼(🌟 🎨 😊 ✨ 등)을 포함하지 마.
- 문체 가이드에 이모지가 있어도 이 규칙이 우선이다. 텍스트로만 따뜻한 묘사를 만들어.
- 의성어·의태어·구체적 행동 묘사로 생생함을 살려 (이모지 없이도 충분히 풍부하게)."""
        emoji_instruction = "이번 알림장은 이모지를 절대 사용하지 마. 텍스트로만 작성해."
    else:
        emoji_section = """=== 이모지(이모티콘) 사용 규칙 ===
- 활동 하나당 본문에 2~3개의 이모지를 자연스럽게 섞어 써. (반드시 2개 이상, 최대 3개. 0개나 4개 이상 금지)
- 이모지는 활동 성격에 맞는 것으로 골라. 영역별 추천 예시:
  · 신체운동·건강: 🤸 🏃 ⚽ 🌟 💪 🦋 🌈
  · 의사소통·언어: 📚 🗣️ ✏️ 💬 📖
  · 사회관계·친구: 🤗 👫 💖 ✨ 🥰
  · 예술경험·미술·음악: 🎨 🖍️ 🎵 🎶 🌸 🍀 🎭
  · 자연탐구·관찰: 🔍 🌱 🐟 🐞 🌊 ☀️ 🍂
  · 식사·간식: 🍚 🥄 🍎 😋
  · 수면·휴식: 😴 💤 🛏️
- 이모지는 문장 사이사이에 자연스럽게 배치해. 한 곳에 몰아서 쓰지 마.
- 이모지는 문장 끝에만 몰지 말고, 관련된 단어 바로 뒤(중간)에 붙여도 좋다. 단어와 이모지 사이에는 공백을 넣지 않는다.
  · 좋은 예: "물놀이🌊를 하며 까르르 웃었어요."
  · 좋은 예: "블록🧱을 높이 쌓아 올리며 뿌듯한 표정을 지었어요."
  · 좋은 예: "퐁당퐁당🌊 물놀이를 하며 까르르 웃었어요😊"
  · 피할 예 (끝에만 몰림): "오늘은 물놀이를 하며 까르르 웃었어요 🌊😊✨"
- 이모지가 특정 명사(교구/자연물/음식 등)를 직접 가리킬 때는 그 단어 뒤에 붙이는 걸 우선한다.
  감정·분위기를 나타낼 때는 문장 끝이나 쉼표 앞에 배치해도 자연스럽다.
- 소제목(영역명 옆 제목)에는 이모지를 쓰지 마. 본문에만 사용해.
- 같은 이모지를 한 활동 안에서 반복하지 마."""
        emoji_instruction = (
            "활동 본문 하나당 이모지를 반드시 2~3개(2개 이상, 3개 이하) 자연스럽게 배치해. "
            "영역 성격에 맞는 이모지를 골라 쓰고, 한 곳에 몰지 말고 문장 사이사이에 흩어 배치해. "
            "명사(교구·자연물·음식 등)를 가리키는 이모지는 그 단어 바로 뒤에 공백 없이 붙여 쓰는 것도 자연스럽다 "
            "(예: '물놀이🌊를 했어요'). 문장 끝에만 몰아 붙이지 마. 소제목에는 이모지를 쓰지 마."
        )

    prompt = f"""
너는 어린이집 보육교사의 알림장 작성을 돕는 AI야.
{photo_section}{style_section}
아래 활동 정보를 바탕으로 학부모님께 전달할 따뜻한 알림장을 작성해줘.

=== 출력 형식 (반드시 준수) ===
숫자. [영역명] 소제목
내용 (250~350자, ~어요 체 위주)

예시:
1. [신체운동·건강] 씩씩하게 뛰어놀아요
오늘 한은이는 ...

※ 영역명은 반드시 대괄호 [ ] 안에 넣어야 해.

활동이 여러 개면 성격에 따라 2개 묶음으로 나눠 작성.
활동이 1개면 1개만 작성.

=== 이름 규칙 ===
아이 이름에서 첫 글자(성)를 제거하고 이름만 사용.
  정한은 → 한은 / 김채린 → 채린 / 나연서 → 연서
이름 끝에 받침 있으면 '이'를 붙인 뒤 조사 연결.
  한은(받침ㄴ) → 한은이가, 한은이는, 한은이와
  채린(받침ㄴ) → 채린이가, 채린이는
이름 끝에 받침 없으면 바로 조사 연결.
  연서 → 연서가, 연서는
성+이름 전체 사용 금지 (예: 정한은이~, 정한은 친구들과~ 모두 금지)

=== 문체 규칙 (사용자 문체 가이드가 위에 있으면 그것을 우선) ===
~어요 / ~했어요 / ~즐겼어요 위주로 작성 (전체 문장의 80% 이상)
~습니다는 최소한으로만 (20% 이하)
~하십시오 / ~하시기 바랍니다 / ~합니다 절대 금지
선생님이 학부모님께 아이 하루를 다정하게 이야기해주는 느낌으로 작성

=== 생생한 묘사 규칙 (매우 중요) ===
"성의 없어 보인다"는 피드백을 받지 않도록, 학부모가 그 장면을 눈앞에서 보는 듯한 알림장을 써야 해.

1) 유아교육 의성어·의태어를 본문 안에 자연스럽게 녹여 적극적으로 사용해. 활동 성격에 맞는 것을 골라 써.
   - 물·바다 놀이: 퐁당, 첨벙첨벙, 출렁출렁, 쏙쏙
   - 미술·쓰기: 끼적끼적, 쓱싹쓱싹, 알록달록, 동글동글, 쭉쭉
   - 신체·움직임: 폴짝폴짝, 살금살금, 뒤뚱뒤뚱, 깡충깡충, 사뿐사뿐
   - 음식·먹기: 냠냠, 오물오물, 호로록, 꿀꺽
   - 탐색·관찰: 빤히, 갸웃갸웃, 말똥말똥, 두리번두리번
   - 감정·표정: 방긋, 싱긋, 까르르, 헤헤
   (위는 예시일 뿐 — 사진과 활동 맥락에 맞는 것을 골라 써. 억지로 끼워 넣지는 마.)

2) 유아교육 현장 용어를 자연스럽게 활용해.
   - "끼적이기" (낙서·그리기를 표현하는 영유아 보육 용어)
   - "탐색해 보고", "탐색 활동", "오감 놀이", "조작 활동"
   - "온몸으로 헤치며", "직접 매칭해 보며", "쏙쏙 건져 보며"
   - "○○ 세상 속으로 빠져보았습니다", "○○ 활동을 해보았어요"

3) 구체적인 행동·표정·감각을 한 문장에 하나씩은 넣어. 추상적인 "즐거워했어요", "재미있어했어요"만 반복하지 마.
   나쁜 예) "오늘 친구들과 즐겁게 활동했어요. 잘 참여했습니다."
   좋은 예) "싸인펜을 손에 꼭 쥐고 활동지를 진지하게 들여다보며 멋지게 끼적이기 활동을 해보았어요. 스스로 해내려는 의지를 보이며 집중하는 모습이 무척 대견했답니다."

4) 색깔·모양·재료·교구 이름을 구체적으로 적어. ("파란색 종이 바다", "하얀색 물고기 모양 조각", "알록달록 동글동글한", "잠자리채(뜰채)")

5) 영역별 소제목은 활동 핵심을 살린 짧고 정겨운 문장체로 지어줘.
   예) "시원한 바다에서 놀이해요", "내가 혼자 할 수 있어요", "씩씩하게 뛰어놀아요"

{emoji_section}

=== 기타 규칙 ===
마크다운 기호(** ## * 등) 사용 금지
이미지 파일명 포함 금지
없는 사실 금지
"학부모님,"으로 시작 금지
식사/수면/특이사항 메모가 있으면 마지막에 한 줄로 자연스럽게 덧붙이고 짧은 인사로 마무리 (건강 외에도 컨디션·기분·친구 관계·전달 사항 등 어떤 내용이든 들어올 수 있음)

=== 입력 정보 ===
아이 이름: {request.child_name}
반: {request.class_name}
날짜: {request.date}

오늘의 활동:
{activities_text}
일상 메모: {daily_notes_text}

알림장만 작성해줘.
"""

    instructions = (
        "너는 어린이집 보육교사의 알림장 작성을 돕는 전문 AI야. "
        "활동 영역은 입력에 '출력 영역(고정)'으로 표시된 경우 그대로 쓰고, "
        "'출력 영역(AI 선택 필요)'인 경우 표준 보육과정 5영역 — 신체운동·건강 / 의사소통 / 사회관계 / 예술경험 / 자연탐구 — 중 하나만 선택해. "
        "[기본생활]·[언어·의사소통]·[창의·탐구]·[놀이]·[실내활동]·[체험활동] 등 목록 외 영역명은 오답이야. "
        "사진이 있으면 사진 속 장면(아이의 손동작·표정·시선·교구·색깔)을 최우선으로 구체적으로 묘사해. "
        "유아교육 의성어·의태어(퐁당, 끼적끼적, 쏙쏙, 폴짝폴짝, 알록달록, 갸웃갸웃 등)와 현장 용어('끼적이기', '탐색해 보고', '온몸으로 헤치며')를 활동 맥락에 맞게 자연스럽게 녹여 써. "
        "추상적인 '즐거웠어요/재미있었어요'만 반복하지 말고, 구체적 행동·표정·감각을 살려 학부모가 그 장면을 눈앞에서 보는 듯하게 작성해. "
        f"{emoji_instruction} "
        "아이 이름은 성(첫 글자) 제거 후 이름만 쓰고, 받침 있으면 '이'를 붙여(한은→한은이가). "
        f"{tone_instructions} "
        "마크다운 없이 출력해."
    )

    try:
        draft = call_openai_with_images(
            prompt=prompt,
            instructions=instructions,
            images=request.images or [],
            max_output_tokens=1200,
        )
        return {"draft": draft, "source": "openai"}
    except Exception as error:
        print("OPENAI DAILY RECORD ERROR:", repr(error))
        return {
            "draft": make_fallback_daily_record(request),
            "source": "fallback",
            "warning": f"OpenAI 호출 실패: {repr(error)}",
        }


@app.post("/analyze-style")
def analyze_style(request: AnalyzeStyleRequest):
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY가 설정되지 않았습니다.")

    samples = [s for s in (request.samples or []) if (s.text or "").strip() or (s.image_base64 or "").strip()]
    if not samples:
        raise HTTPException(status_code=400, detail="분석할 알림장 샘플이 없습니다.")
    if len(samples) > 5:
        raise HTTPException(status_code=400, detail="알림장 샘플은 최대 5개까지 분석할 수 있습니다.")

    texts: List[str] = []
    images: List[str] = []
    for idx, s in enumerate(samples, 1):
        if s.kind == "text" and (s.text or "").strip():
            texts.append(f"[샘플 {idx} — 텍스트]\n{s.text.strip()}")
        elif s.kind == "image" and (s.image_base64 or "").strip():
            texts.append(f"[샘플 {idx} — 이미지 첨부됨: 이미지 속 알림장 본문을 읽어서 함께 반영]")
            images.append(s.image_base64)

    samples_text = "\n\n".join(texts) if texts else "(텍스트 샘플 없음, 이미지만 제공됨)"

    prompt = f"""
아래는 어린이집 보육교사 한 명이 기존에 쓰던 알림장 샘플들이야 (텍스트 또는 이미지).
이 교사가 앞으로 새 알림장을 쓸 때 동일한 문체로 자동 작성될 수 있도록,
샘플들에서 공통적으로 나타나는 문체적 특징을 한국어로 정리해줘.

분석해야 할 항목:
1) 문장 종결 어미 패턴 (예: ~어요, ~했답니다, ~네요, ~입니다 등 — 비율도 추정)
2) 평균 문장 길이와 한 알림장의 평균 길이(글자 수 범위)
3) 자주 등장하는 시작 표현 / 마무리 인사 표현
4) 자주 쓰는 어휘·표현·의성어·의태어 (구체적인 단어 목록)
5) 호칭 (학부모님, 어머님, 부모님 등) 및 아이 지칭 방법
6) 이모지·특수문자·줄바꿈 패턴
7) 활동을 설명하는 톤 (담백 / 다정 / 격식 / 친근 등)
8) 그 외 이 교사만의 두드러진 습관

반드시 아래 형식의 plain text로 응답해 (마크다운, JSON, 코드블록 금지):

문장 종결: ...
평균 길이: ...
시작 표현: ...
마무리 표현: ...
자주 쓰는 어휘: ...
호칭/아이 지칭: ...
이모지/특수문자: ...
전체적인 톤: ...
기타 특징: ...

샘플:
{samples_text}
"""

    instructions = (
        "너는 한국어 보육 알림장 문체 분석가야. "
        "주어진 샘플들에서 공통된 문체적 특징을 정확하고 간결하게 한국어로 정리해. "
        "샘플에 없는 추측은 하지 말고, 마크다운/코드블록 없이 plain text로만 응답해."
    )

    try:
        if images:
            guide = call_openai_with_images(
                prompt=prompt,
                instructions=instructions,
                images=images,
                max_output_tokens=900,
            )
        else:
            guide = call_openai_text(prompt, instructions, max_output_tokens=900)
        return {"style_guide": (guide or "").strip()}
    except Exception as error:
        print("STYLE ANALYSIS ERROR:", repr(error))
        raise HTTPException(status_code=500, detail=f"문체 분석 중 오류: {repr(error)}")


@app.post("/generate-observation-structured")
def generate_observation_structured(request: ObservationRequest):
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY가 설정되지 않았습니다.")
    if len(request.records) == 0:
        raise HTTPException(status_code=400, detail="보육일지 기록이 없습니다.")
    return _run_structured_observation(request)


@app.post("/export-observation-docx")
def export_observation_docx(request: ExportDocxRequest):
    try:
        docx_bytes = build_observation_docx(request)
        filename = f"관찰일지_{request.child_name}_{request.observation_date}.docx"
        encoded_filename = quote(filename, safe="")
        return StreamingResponse(
            io.BytesIO(docx_bytes),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"},
        )
    except Exception as error:
        print("DOCX EXPORT ERROR:", repr(error))
        raise HTTPException(status_code=500, detail=f"docx 생성 중 오류: {repr(error)}")


# ──────────────── 내부 함수 ────────────────

def _extract_json(text: str) -> str:
    fence = re.search(r'```(?:json)?\s*([\s\S]+?)\s*```', text)
    if fence:
        return fence.group(1)
    try:
        start = text.index('{')
        end = text.rindex('}') + 1
        return text[start:end]
    except ValueError:
        return text.strip()


def _fallback_observation_categories() -> dict:
    placeholder = "AI 생성에 실패했습니다. 직접 내용을 입력해주세요."
    return {k: placeholder for k in ["기본생활습관", "신체건강", "의사소통", "사회관계", "예술경험", "자연탐구", "총평"]}


_AGE_GUIDANCE = {
    0: "감각 탐색과 신체 감각 인식, 양육자와의 애착 형성, 옹알이와 기초 의사소통 시작 단계.",
    1: "혼자 걷기·뛰기 등 대근육 발달, 초기 언어(단어) 사용 시작, 대상영속성 이해.",
    2: "언어 폭발기(두 단어 조합→짧은 문장), 자아 표현과 자기주장 강해짐. 병행 놀이, 모방 놀이 활발.",
    3: "상상·역할 놀이 발달, 또래와의 상호작용 시작, 언어 급성장(질문 많음).",
    4: "협동 놀이와 규칙 이해·준수, 감정 조절 능력 발달, 복잡한 언어 표현.",
    5: "문해력·수 개념 기초 형성, 복잡한 사회적 상호작용, 계획·목표 지향 행동.",
}


def _run_structured_observation(request: ObservationRequest) -> dict:
    age = request.child_age if request.child_age is not None else 2
    age_guidance = _AGE_GUIDANCE.get(age, _AGE_GUIDANCE[2])

    records_text = ""
    for r in request.records:
        activities_summary = ""
        if r.activities:
            for a in r.activities:
                activities_summary += f"  - [{a.category}] {a.title}"
                if a.memo:
                    activities_summary += f": {a.memo}"
                activities_summary += "\n"
        else:
            activities_summary = "  (활동 정보 없음)\n"

        records_text += f"""
날짜: {r.date}
활동:
{activities_summary}최종 알림장:
{r.teacher_final}
식사: {r.meal_note or '없음'} / 수면: {r.nap_note or '없음'} / 특이사항: {r.health_note or '없음'}
---
"""

    child_notes_section = ""
    if (request.child_observation_notes or "").strip():
        child_notes_section = f"""
교사 관찰 메모 (이 아이에 대해 교사가 직접 기록한 내용):
{request.child_observation_notes}
---
"""

    prompt = f"""
너는 어린이집 보육교사의 관찰일지 작성을 돕는 AI야.
아래 알림장 기록과 교사 관찰 메모를 바탕으로 7개 생활영역 관찰일지를 작성해줘.

아이 발달 단계: 만 {age}세
만 {age}세 발달 특성: {age_guidance}

작성 원칙:
- 반드시 제공된 기록과 관찰 메모에 근거해서만 작성한다.
- 기록에 없는 내용은 절대 만들지 않는다.
- 만 {age}세 발달 수준에 맞게 작성한다.
- 각 영역 80~120자, 총평 100~150자로 간결하게 작성한다.
- 실제 어린이집 관찰일지 문체로 자연스럽게 서술한다.

아이 이름: {request.child_name}
반: {request.class_name}
기간: {request.start_date} ~ {request.end_date}
{child_notes_section}
알림장 기록:
{records_text}

반드시 아래 JSON 형식으로만 응답해:
{{
  "기본생활습관": "...",
  "신체건강": "...",
  "의사소통": "...",
  "사회관계": "...",
  "예술경험": "...",
  "자연탐구": "...",
  "총평": "..."
}}
"""

    try:
        response = client_observation.responses.create(
            model=model_name,
            instructions=(
                f"너는 어린이집 만 {age}세반 보육교사의 관찰일지 작성을 돕는 AI야. "
                "제공된 기록에 근거해서만 작성하고, 반드시 JSON 형식으로만 응답해."
            ),
            input=prompt,
            max_output_tokens=1800,
        )
        raw = _extract_json(response.output_text)
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print("JSON ERROR:", repr(e))
        return _fallback_observation_categories()
    except Exception as e:
        print("OBSERVATION ERROR:", repr(e))
        return _fallback_observation_categories()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
