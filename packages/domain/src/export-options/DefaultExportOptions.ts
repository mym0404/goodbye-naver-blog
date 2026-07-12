import type { ExportOptions } from "./schema/ExportOptions.js"

import { allExportProfiles } from "../export-job/schema/ExportProfile.js"

export const defaultExportOptions = (): ExportOptions => ({
  scope: {
    categoryIds: [],
    categoryMode: "selected-and-descendants",
    dateFrom: null,
    dateTo: null,
  },
  structure: {
    groupByCategory: true,
    slugStyle: "snake",
    slugWhitespace: "underscore",
    postFolderNameTemplate: "{{ date }}-{{ slug }}",
  },
  frontmatter: {
    enabled: true,
    fields: {
      title: true,
      source: true,
      blogKey: true,
      sourceId: true,
      postId: true,
      publishedAt: true,
      category: true,
      categoryPath: true,
      tags: true,
      thumbnail: true,
      exportedAt: true,
      assetPaths: false,
    },
    aliases: {
      title: "",
      source: "",
      blogKey: "",
      sourceId: "",
      postId: "",
      publishedAt: "",
      category: "",
      categoryPath: "",
      tags: "",
      thumbnail: "",
      exportedAt: "",
      assetPaths: "",
    },
  },
  blockOutputs: {
    templates: Object.fromEntries(allExportProfiles.map((profile) => [profile, {}])),
  },
  assets: {
    imageHandlingMode: "download-and-upload",
    compressionEnabled: true,
    downloadFailureMode: "fail",
    stickerAssetMode: "ignore",
    downloadImages: true,
    downloadThumbnails: true,
    includeImageCaptions: false,
    thumbnailSource: "post-list-first",
  },
  links: {
    sameBlogPostMode: "keep-source",
    sameBlogPostCustomUrlTemplate: "",
  },
})
