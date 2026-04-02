import { describe, it, expect } from 'vitest';
import { parseBody } from '../../components/ResponsePanel/BodyViewer/Parser';

describe('parseBody – JSON', () => {
  it('detects JSON object from content-type', () => {
    const r = parseBody('{"key":"value"}', 'application/json');
    expect(r.type).toBe('json');
    expect(r.data).toEqual({ key: 'value' });
  });

  it('detects JSON array from content-type', () => {
    const r = parseBody('[1,2,3]', 'application/json');
    expect(r.type).toBe('json');
    expect(r.data).toEqual([1, 2, 3]);
  });

  it('falls back to text on malformed JSON with content-type', () => {
    const r = parseBody('{bad json}', 'application/json');
    expect(r.type).toBe('text');
  });

  it('sniffs JSON object from body when no content-type', () => {
    expect(parseBody('{"a":1}').type).toBe('json');
  });

  it('sniffs JSON array from body when no content-type', () => {
    expect(parseBody('[1,2,3]').type).toBe('json');
  });

  it('preserves raw field for JSON', () => {
    const body = '{"a":1}';
    expect(parseBody(body, 'application/json').raw).toBe(body);
  });
});

describe('parseBody – HTML', () => {
  it('detects HTML from content-type', () => {
    expect(parseBody('<html/>', 'text/html').type).toBe('html');
  });

  it('sniffs HTML via <!DOCTYPE html>', () => {
    expect(parseBody('<!DOCTYPE html><html></html>').type).toBe('html');
  });

  it('sniffs HTML via <html> tag', () => {
    expect(parseBody('<html>').type).toBe('html');
  });

  it('case-insensitive sniff for <!doctype html>', () => {
    expect(parseBody('<!doctype html><html>').type).toBe('html');
  });
});

describe('parseBody – XML', () => {
  it('detects XML from application/xml content-type', () => {
    expect(parseBody('<root/>', 'application/xml').type).toBe('xml');
  });

  it('detects XML from text/xml content-type', () => {
    expect(parseBody('<root/>', 'text/xml').type).toBe('xml');
  });

  it('detects SVG from image/svg+xml content-type', () => {
    expect(parseBody('<svg/>', 'image/svg+xml').type).toBe('xml');
  });

  it('sniffs XML from body (non-html tag)', () => {
    expect(parseBody('<?xml version="1.0"?><root/>').type).toBe('xml');
  });

  it('sniffs generic XML tag as xml', () => {
    expect(parseBody('<root><child/></root>').type).toBe('xml');
  });
});

describe('parseBody – Markdown', () => {
  it('detects markdown from text/markdown content-type', () => {
    expect(parseBody('# Title', 'text/markdown').type).toBe('markdown');
  });

  it('detects markdown from text/x-markdown content-type', () => {
    expect(parseBody('# Title', 'text/x-markdown').type).toBe('markdown');
  });
});

describe('parseBody – Image / PDF / Video / Audio', () => {
  it('detects image/png and stores base64 in data', () => {
    const r = parseBody('', 'image/png', 'abc123');
    expect(r.type).toBe('image');
    expect(r.data).toBe('abc123');
  });

  it('detects image type without base64', () => {
    const r = parseBody('raw', 'image/jpeg');
    expect(r.type).toBe('image');
    expect(r.data).toBe('raw'); // falls back to body string
  });

  it('detects application/pdf', () => {
    const r = parseBody('', 'application/pdf', 'pdfbase64');
    expect(r.type).toBe('pdf');
    expect(r.data).toBe('pdfbase64');
  });

  it('detects video/mp4', () => {
    expect(parseBody('', 'video/mp4', 'vid64').type).toBe('video');
  });

  it('detects audio/mpeg', () => {
    expect(parseBody('', 'audio/mpeg', 'aud64').type).toBe('audio');
  });
});

describe('parseBody – Binary', () => {
  it('detects application/octet-stream as binary', () => {
    expect(parseBody('...', 'application/octet-stream').type).toBe('binary');
  });

  it('detects application/zip as binary', () => {
    expect(parseBody('...', 'application/zip').type).toBe('binary');
  });
});

describe('parseBody – Text fallback', () => {
  it('falls back to text for text/plain', () => {
    expect(parseBody('hello world', 'text/plain').type).toBe('text');
  });

  it('falls back to text when no content-type and no recognisable pattern', () => {
    expect(parseBody('just plain text').type).toBe('text');
  });

  it('falls back to text for malformed sniffed JSON', () => {
    expect(parseBody('{definitely not json', undefined).type).toBe('text');
  });

  it('preserves raw for text fallback', () => {
    const body = 'hello';
    expect(parseBody(body).raw).toBe(body);
  });
});

describe('parseBody – content-type with charset param', () => {
  it('strips charset and detects JSON', () => {
    expect(parseBody('{"a":1}', 'application/json; charset=utf-8').type).toBe('json');
  });

  it('strips charset and detects HTML', () => {
    expect(parseBody('<html/>', 'text/html; charset=utf-8').type).toBe('html');
  });
});
