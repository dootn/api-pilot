import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AutoComplete } from '../../components/shared/AutoComplete';

describe('AutoComplete', () => {
  const suggestions = [
    { label: 'Accept', description: 'Media types' },
    { label: 'Authorization', description: 'Auth credentials' },
    { label: 'Content-Type', description: 'Body media type' },
    { label: 'Cache-Control', description: 'Caching' },
  ];

  it('should render an input with placeholder', () => {
    render(
      <AutoComplete
        value=""
        onChange={vi.fn()}
        suggestions={suggestions}
        placeholder="Enter header"
      />
    );
    expect(screen.getByPlaceholderText('Enter header')).toBeDefined();
  });

  it('should display current value in input', () => {
    render(
      <AutoComplete value="Accept" onChange={vi.fn()} suggestions={suggestions} />
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('Accept');
  });

  it('should show dropdown on focus when suggestions exist', () => {
    render(
      <AutoComplete value="" onChange={vi.fn()} suggestions={suggestions} />
    );
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    // Dropdown should appear
    expect(screen.getByText('Accept')).toBeDefined();
    expect(screen.getByText('Authorization')).toBeDefined();
  });

  it('should call onChange when typing', () => {
    const onChange = vi.fn();
    render(
      <AutoComplete value="" onChange={onChange} suggestions={suggestions} />
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Con' } });
    expect(onChange).toHaveBeenCalledWith('Con');
  });

  it('should select suggestion on click', () => {
    const onChange = vi.fn();
    render(
      <AutoComplete value="" onChange={onChange} suggestions={suggestions} />
    );
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    const option = screen.getByText('Content-Type');
    fireEvent.mouseDown(option);
    expect(onChange).toHaveBeenCalledWith('Content-Type');
  });

  it('should navigate with arrow keys', () => {
    render(
      <AutoComplete value="" onChange={vi.fn()} suggestions={suggestions} />
    );
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // Active index should be at 1 (Authorization)
    // The dropdown should be visible
    expect(screen.getByText('Authorization')).toBeDefined();
  });

  it('should close dropdown on Escape', () => {
    const { container } = render(
      <AutoComplete value="" onChange={vi.fn()} suggestions={suggestions} />
    );
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    expect(screen.getByText('Accept')).toBeDefined();
    fireEvent.keyDown(input, { key: 'Escape' });
    // Dropdown should close
    const dropdown = container.querySelector('.autocomplete-dropdown');
    expect(dropdown).toBeNull();
  });

  it('should select on Enter when item is active', () => {
    const onChange = vi.fn();
    render(
      <AutoComplete value="" onChange={onChange} suggestions={suggestions} />
    );
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // open + index 0
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('Accept');
  });

  it('should not show dropdown when no suggestions', () => {
    const { container } = render(
      <AutoComplete value="" onChange={vi.fn()} suggestions={[]} />
    );
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    const dropdown = container.querySelector('.autocomplete-dropdown');
    expect(dropdown).toBeNull();
  });
});
