import type { AudienceLevel, Language, SourceSummary, TextRequest } from './types'


export const EXAMPLE_ARTIFACT = {
  id: 1,
  artifactId: 'PS0100100100100331200000',
  nameKr: '금동 반가사유상',
  nameCn: '金銅半跏思惟像',
  museumName: '국립중앙박물관',
  fo: '높이 90.8cm',
  designationInfo: '국보',
  nationalityCountry: '한국',
  nationalityEra: '삼국',
  purposeType1: '종교신앙',
  purposeType2: '불교',
  purposeType3: '예배',
  purposeType4: '불상',
  materialCategory: '금속',
  materialPrimary: '금동',
  relicNoLocation: '덕수',
  relicNoNumber: 3312,
  desc: '왼쪽 무릎 위에 오른쪽 다리를 걸치고 고개 숙인 얼굴의 뺨에 오른쪽 손가락을 살짝 대어 깊은 명상에 잠긴 모습의 반가사유상입니다.',
}


export const EXAMPLE_MUSEUM_BUNDLE = {
  museum: {
    name: '국립중앙박물관',
    city: '서울',
    theme: '한국 불교 조각 주요 흐름',
  },
  chapters: [
    {
      title: '사유의 형상',
      description: '반가사유상 계열 작품을 중심으로 사유의 자세와 표정을 비교하는 챕터',
      artifacts: [
        EXAMPLE_ARTIFACT,
        {
          artifactId: 'PS0100100100100000000002',
          nameKr: '금동 작은 반가사유상',
          nationalityCountry: '한국',
          nationalityEra: '삼국',
          materialPrimary: '금동',
          desc: '한 손을 뺨에 댄 채 깊이 생각에 잠긴 작은 반가사유상입니다.',
        },
      ],
    },
    {
      title: '예배의 공간',
      description: '예배와 수행의 장면을 떠올리게 하는 불상들을 묶은 챕터',
      artifacts: [
        {
          artifactId: 'PS0100100100100000000003',
          nameKr: '석조 보살 입상',
          nationalityCountry: '한국',
          nationalityEra: '통일신라',
          materialPrimary: '석조',
          desc: '길게 늘어진 옷주름과 차분한 얼굴이 돋보이는 보살 입상입니다.',
        },
      ],
    },
  ],
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}


function getMuseumName(payload: Record<string, unknown>): string | null {
  if (isRecord(payload.museum) && typeof payload.museum.name === 'string' && payload.museum.name.trim()) {
    return payload.museum.name.trim()
  }
  if (typeof payload.museumName === 'string' && payload.museumName.trim()) {
    return payload.museumName.trim()
  }
  return null
}


function getArtifactCount(payload: Record<string, unknown>): number {
  const artifacts = Array.isArray(payload.artifacts) ? payload.artifacts : Array.isArray(payload.samples) ? payload.samples : null
  if (!artifacts) {
    return 1
  }
  return artifacts.filter(isRecord).length
}


function getChapterTitle(payload: Record<string, unknown>, fallback: string): string {
  if (typeof payload.title === 'string' && payload.title.trim()) {
    return payload.title.trim()
  }
  if (typeof payload.name === 'string' && payload.name.trim()) {
    return payload.name.trim()
  }
  if (typeof payload.chapterTitle === 'string' && payload.chapterTitle.trim()) {
    return payload.chapterTitle.trim()
  }
  if (isRecord(payload.chapter)) {
    if (typeof payload.chapter.title === 'string' && payload.chapter.title.trim()) {
      return payload.chapter.title.trim()
    }
    if (typeof payload.chapter.name === 'string' && payload.chapter.name.trim()) {
      return payload.chapter.name.trim()
    }
  }
  return fallback
}


export function summarizeSourceInput(sourceJson: string): SourceSummary | null {
  try {
    const parsed = JSON.parse(sourceJson) as Record<string, unknown>
    const museumName = getMuseumName(parsed)

    if (Array.isArray(parsed.chapters)) {
      const chapters = parsed.chapters
        .filter(isRecord)
        .map((chapter, index) => ({
          index,
          title: getChapterTitle(chapter, `Chapter ${index + 1}`),
          artifactCount: getArtifactCount(chapter),
          description: typeof chapter.description === 'string' ? chapter.description : undefined,
        }))

      const artifactCount = chapters.reduce((sum, chapter) => sum + chapter.artifactCount, 0)
      return {
        scope: 'chapter',
        displayName: museumName ?? 'Museum Bundle',
        museumName,
        artifactCount,
        chapters,
      }
    }

    if (Array.isArray(parsed.artifacts) || Array.isArray(parsed.samples)) {
      return {
        scope: 'chapter',
        displayName: getChapterTitle(parsed, museumName ?? 'Museum Chapter'),
        museumName,
        artifactCount: getArtifactCount(parsed),
        chapters: [
          {
            index: 0,
            title: getChapterTitle(parsed, 'Default Chapter'),
            artifactCount: getArtifactCount(parsed),
            description: typeof parsed.description === 'string' ? parsed.description : undefined,
          },
        ],
      }
    }

    return {
      scope: 'artifact',
      displayName:
        (typeof parsed.nameKr === 'string' && parsed.nameKr.trim()) ||
        (typeof parsed.artifactId === 'string' && parsed.artifactId.trim()) ||
        '도슨트 대상',
      museumName,
      artifactCount: 1,
      chapters: [],
    }
  } catch {
    return null
  }
}


export function buildTextRequest(
  sourceJson: string,
  chapterIndex: number | null,
  language: Language,
  level: AudienceLevel = 'general',
  useKnowledge = false,
): TextRequest {
  const parsed = JSON.parse(sourceJson) as Record<string, unknown>
  const hasChapterShape =
    Array.isArray(parsed.chapters) ||
    Array.isArray(parsed.artifacts) ||
    Array.isArray(parsed.samples)

  if (hasChapterShape) {
    return {
      source: parsed,
      chapter_index: chapterIndex ?? undefined,
      language,
      level,
      use_knowledge: useKnowledge,
    }
  }

  return {
    artifact: parsed,
    language,
    level,
    use_knowledge: useKnowledge,
  }
}
