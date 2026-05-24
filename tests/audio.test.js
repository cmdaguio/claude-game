import { describe, it, expect } from 'vitest';
import { parseYouTubeId } from '../src/audio.js';

describe('parseYouTubeId', () => {
  it('parses youtube.com/watch?v= URLs', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('parses youtu.be short URLs', () => {
    expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('parses youtube.com/shorts URLs', () => {
    expect(parseYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('parses youtube.com/embed URLs', () => {
    expect(parseYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('ignores trailing query params', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for non-YouTube URLs', () => {
    expect(parseYouTubeId('https://vimeo.com/12345')).toBe(null);
  });

  it('returns null for garbage input', () => {
    expect(parseYouTubeId('not a url')).toBe(null);
    expect(parseYouTubeId('')).toBe(null);
  });
});
