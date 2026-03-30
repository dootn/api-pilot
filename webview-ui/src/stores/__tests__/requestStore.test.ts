import { describe, it, expect, beforeEach } from 'vitest';
import { useRequestStore } from '../../stores/requestStore';

describe('requestStore', () => {
  beforeEach(() => {
    // Reset to defaults
    useRequestStore.setState({
      method: 'GET',
      url: '',
      params: [{ key: '', value: '', enabled: true }],
      headers: [{ key: '', value: '', enabled: true }],
      body: { type: 'none' },
      auth: { type: 'none' },
      activeTab: 'params',
      response: null,
      responseError: null,
      loading: false,
    });
  });

  it('should have correct defaults', () => {
    const state = useRequestStore.getState();
    expect(state.method).toBe('GET');
    expect(state.url).toBe('');
    expect(state.loading).toBe(false);
    expect(state.response).toBeNull();
  });

  it('should update method', () => {
    useRequestStore.getState().setMethod('POST');
    expect(useRequestStore.getState().method).toBe('POST');
  });

  it('should update url', () => {
    useRequestStore.getState().setUrl('https://api.com');
    expect(useRequestStore.getState().url).toBe('https://api.com');
  });

  it('should update params', () => {
    const params = [{ key: 'q', value: 'test', enabled: true }];
    useRequestStore.getState().setParams(params);
    expect(useRequestStore.getState().params).toEqual(params);
  });

  it('should update headers', () => {
    const headers = [{ key: 'X-Custom', value: 'val', enabled: true }];
    useRequestStore.getState().setHeaders(headers);
    expect(useRequestStore.getState().headers).toEqual(headers);
  });

  it('should update body', () => {
    useRequestStore.getState().setBody({ type: 'json', raw: '{}' });
    expect(useRequestStore.getState().body).toEqual({ type: 'json', raw: '{}' });
  });

  it('should update auth', () => {
    useRequestStore.getState().setAuth({ type: 'bearer', token: 'tk' });
    expect(useRequestStore.getState().auth).toEqual({ type: 'bearer', token: 'tk' });
  });

  it('should update active tab', () => {
    useRequestStore.getState().setActiveTab('headers');
    expect(useRequestStore.getState().activeTab).toBe('headers');
  });

  it('should set response and clear error', () => {
    useRequestStore.getState().setResponseError('some error');
    const response = {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
      bodySize: 2,
      time: 100,
    };
    useRequestStore.getState().setResponse(response);
    expect(useRequestStore.getState().response).toEqual(response);
    expect(useRequestStore.getState().responseError).toBeNull();
  });

  it('should set error and clear response', () => {
    useRequestStore.getState().setResponse({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
      bodySize: 2,
      time: 100,
    });
    useRequestStore.getState().setResponseError('Network error');
    expect(useRequestStore.getState().responseError).toBe('Network error');
    expect(useRequestStore.getState().response).toBeNull();
  });

  it('should update loading state', () => {
    useRequestStore.getState().setLoading(true);
    expect(useRequestStore.getState().loading).toBe(true);
    useRequestStore.getState().setLoading(false);
    expect(useRequestStore.getState().loading).toBe(false);
  });
});
