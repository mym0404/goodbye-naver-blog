import { getDefaultSlugWhitespace } from "@exitpress/domain/export-options/ExportOptions.js"
import { buildPostFolderName } from "@exitpress/domain/export-paths/PostPathTemplate.js"
import { Box, Text } from "@primer/react"

import type { ExportOptions } from "@exitpress/domain/export-options/schema/ExportOptions.js"
import type { ThemePreference } from "@exitpress/domain/preferences/schema/ThemePreference.js"

import {
  CheckField,
  EmbeddedOptionPanel,
  OptionField,
  OptionSection,
  OptionSelectField,
  OptionWideBox,
} from "./OptionControls.js"
import { postTemplatePropDefinitions } from "./PostTemplateProps.js"
import {
  buildStructurePreviewTree,
  StructurePreviewTree,
  structurePreviewSample,
} from "./StructurePreview.js"
import { TemplateEditorCard } from "./TemplateEditorCard.js"
import { getTemplatePreview } from "./TemplatePreview.js"

export const StructureOptionsStep = ({
  outputDir,
  options,
  description,
  themePreference,
  onOptionsChange,
}: {
  outputDir: string
  options: ExportOptions
  description: (key: string) => string | undefined
  themePreference: ThemePreference
  onOptionsChange: (updater: (current: ExportOptions) => ExportOptions) => void
}) => {
  const structureTemplatePreviewPost = {
    blogKey: "naver",
    sourceId: "mym0404",
    postId: structurePreviewSample.posts[0]?.postId ?? "223034929697",
    title: structurePreviewSample.posts[0]?.title ?? "첫 글",
    publishedAt: structurePreviewSample.posts[0]?.publishedAt ?? "2026-04-11T04:00:00.000Z",
    categoryName: structurePreviewSample.posts[0]?.categoryPath.at(-1) ?? "React",
  }
  const postFolderNameTemplate = options.structure.postFolderNameTemplate.trim()
  const postFolderNamePreview = postFolderNameTemplate
    ? getTemplatePreview(() =>
        buildPostFolderName({
          post: structureTemplatePreviewPost,
          options: {
            structure: options.structure,
          },
        }),
      )
    : undefined
  const structurePreviewTree = buildStructurePreviewTree({
    outputDir,
    options,
  })

  return (
    <OptionSection title="구조" note="출력 폴더와 파일 이름 규칙">
      <CheckField
        inputId="structure-groupByCategory"
        optionKey="structure-groupByCategory"
        label="카테고리 폴더 유지"
        description={description("structure-groupByCategory")}
        checked={options.structure.groupByCategory}
        onChange={(checked) =>
          onOptionsChange((current) => ({
            ...current,
            structure: {
              ...current.structure,
              groupByCategory: checked,
            },
          }))
        }
      />

      <OptionField
        optionKey="structure-slugStyle"
        labelFor="structure-slugStyle"
        label="slug와 카테고리 표기 방식"
        description={description("structure-slugStyle")}
      >
        <OptionSelectField
          inputId="structure-slugStyle"
          value={options.structure.slugStyle}
          options={[
            { value: "kebab", label: "kebab-case" },
            { value: "snake", label: "snake_case" },
            { value: "keep-title", label: "원본 제목 유지" },
          ]}
          onValueChange={(slugStyle) =>
            onOptionsChange((current) => ({
              ...current,
              structure: {
                ...current.structure,
                slugStyle,
                slugWhitespace: getDefaultSlugWhitespace(slugStyle),
              },
            }))
          }
        />
      </OptionField>

      <OptionField
        optionKey="structure-slugWhitespace"
        labelFor="structure-slugWhitespace"
        label="slug와 카테고리 공백 처리"
        description={description("structure-slugWhitespace")}
      >
        <OptionSelectField
          inputId="structure-slugWhitespace"
          value={options.structure.slugWhitespace}
          options={[
            { value: "dash", label: "-로 바꾸기" },
            { value: "underscore", label: "_로 바꾸기" },
            { value: "keep-space", label: "공백 유지" },
          ]}
          onValueChange={(slugWhitespace) =>
            onOptionsChange((current) => ({
              ...current,
              structure: {
                ...current.structure,
                slugWhitespace,
              },
            }))
          }
        />
      </OptionField>

      <OptionWideBox>
        <Box sx={{ display: "grid", gap: 3 }}>
          <TemplateEditorCard
            title="폴더명 템플릿"
            editorId="structure-postFolderNameTemplate"
            props={postTemplatePropDefinitions}
            value={options.structure.postFolderNameTemplate}
            themePreference={themePreference}
            minHeight="6.5rem"
            surface="embedded"
            onTemplateChange={(postFolderNameTemplate) =>
              onOptionsChange((current) => ({
                ...current,
                structure: {
                  ...current.structure,
                  postFolderNameTemplate,
                },
              }))
            }
          />

          <EmbeddedOptionPanel>
            <Text sx={{ fontSize: 1, fontWeight: "semibold" }}>실시간 폴더명 예시</Text>

            <Box
              sx={{ color: "fg.muted", display: "grid", fontSize: 1, gap: 2, lineHeight: "24px" }}
            >
              <Text>폴더 이름 결과</Text>
              <Box
                as="code"
                id="structure-postFolderNameTemplatePreview"
                role={postFolderNamePreview?.status === "error" ? "alert" : undefined}
                sx={{
                  bg: postFolderNamePreview?.status === "error" ? "danger.subtle" : "canvas.inset",
                  border: "1px solid",
                  borderColor:
                    postFolderNamePreview?.status === "error" ? "danger.muted" : "border.default",
                  borderRadius: 2,
                  color: postFolderNamePreview?.status === "error" ? "danger.fg" : "fg.default",
                  display: "block",
                  fontFamily: "mono",
                  fontSize: 0,
                  lineHeight: "20px",
                  overflowWrap: "anywhere",
                  px: 3,
                  py: 2,
                }}
              >
                {postFolderNamePreview?.status === "success"
                  ? postFolderNamePreview.text
                  : (postFolderNamePreview?.message ??
                    "템플릿을 입력하면 결과가 여기에서 바로 바뀝니다.")}
              </Box>
            </Box>
          </EmbeddedOptionPanel>
        </Box>
      </OptionWideBox>

      <OptionWideBox id="structure-file-tree-preview">
        <EmbeddedOptionPanel>
          <Box sx={{ display: "grid", gap: 1 }}>
            <Text sx={{ fontSize: 1, fontWeight: "semibold" }}>예시 파일 트리</Text>
            <Text sx={{ color: "fg.muted", fontSize: 1, lineHeight: "24px" }}>
              현재 옵션으로 여러 글을 저장했을 때의 예시입니다.
            </Text>
          </Box>
          <Box
            sx={{
              bg: "canvas.inset",
              border: "1px solid",
              borderColor: "border.default",
              borderRadius: 2,
              p: 2,
            }}
          >
            <StructurePreviewTree node={structurePreviewTree} />
          </Box>
        </EmbeddedOptionPanel>
      </OptionWideBox>
    </OptionSection>
  )
}
