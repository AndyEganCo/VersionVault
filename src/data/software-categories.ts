export const softwareCategories = {
  PRESENTATION: 'Presentation & Playback',
  VIDEO: 'Video Production',
  AUDIO: 'Audio Production',
  LIGHTING: 'Lighting Control',
  CONTROL: 'Show Control',
  DESIGN: 'Design & Planning',
  NETWORK: 'Network & Control',
  PROJECT: 'Project Management'
} as const;

export type CategoryKey = keyof typeof softwareCategories;