import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeyValueEditor } from '../../components/shared/KeyValueEditor';

describe('KeyValueEditor', () => {
  const defaultItems = [{ key: '', value: '', enabled: true }];

  it('should render with initial empty row', () => {
    const onChange = vi.fn();
    render(<KeyValueEditor items={defaultItems} onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThanOrEqual(2); // key + value
  });

  it('should display items with key and value', () => {
    const items = [
      { key: 'Accept', value: 'application/json', enabled: true },
      { key: '', value: '', enabled: true },
    ];
    const onChange = vi.fn();
    render(<KeyValueEditor items={items} onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs[0]).toHaveValue('Accept');
    expect(inputs[1]).toHaveValue('application/json');
  });

  it('should call onChange when key is updated', () => {
    const onChange = vi.fn();
    render(<KeyValueEditor items={defaultItems} onChange={onChange} />);
    const keyInput = screen.getAllByPlaceholderText('Key')[0];
    fireEvent.change(keyInput, { target: { value: 'Authorization' } });
    expect(onChange).toHaveBeenCalled();
    const newItems = onChange.mock.calls[0][0];
    expect(newItems[0].key).toBe('Authorization');
  });

  it('should call onChange when value is updated', () => {
    const onChange = vi.fn();
    render(<KeyValueEditor items={defaultItems} onChange={onChange} />);
    const valueInput = screen.getAllByPlaceholderText('Value')[0];
    fireEvent.change(valueInput, { target: { value: 'Bearer token' } });
    expect(onChange).toHaveBeenCalled();
    const newItems = onChange.mock.calls[0][0];
    expect(newItems[0].value).toBe('Bearer token');
  });

  it('should auto-add empty row when last item is filled', () => {
    const items = [{ key: 'X-Custom', value: '', enabled: true }];
    const onChange = vi.fn();
    render(<KeyValueEditor items={items} onChange={onChange} />);
    const keyInput = screen.getAllByPlaceholderText('Key')[0];
    fireEvent.change(keyInput, { target: { value: 'Changed' } });
    const newItems = onChange.mock.calls[0][0];
    expect(newItems.length).toBeGreaterThan(1);
    expect(newItems[newItems.length - 1].key).toBe('');
  });

  it('should toggle checkbox', () => {
    const items = [
      { key: 'Accept', value: 'test', enabled: true },
      { key: '', value: '', enabled: true },
    ];
    const onChange = vi.fn();
    render(<KeyValueEditor items={items} onChange={onChange} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(onChange).toHaveBeenCalled();
  });

  it('should remove an item when delete is clicked', () => {
    const items = [
      { key: 'Accept', value: 'json', enabled: true },
      { key: 'Content-Type', value: 'json', enabled: true },
    ];
    const onChange = vi.fn();
    render(<KeyValueEditor items={items} onChange={onChange} />);
    const deleteButtons = screen.getAllByTitle('Remove');
    fireEvent.click(deleteButtons[0]);
    expect(onChange).toHaveBeenCalled();
    const newItems = onChange.mock.calls[0][0];
    expect(newItems).toHaveLength(1);
    expect(newItems[0].key).toBe('Content-Type');
  });

  it('should not remove the last item', () => {
    const onChange = vi.fn();
    render(<KeyValueEditor items={defaultItems} onChange={onChange} />);
    const deleteButtons = screen.getAllByTitle('Remove');
    fireEvent.click(deleteButtons[0]);
    // onChange should NOT be called since we can't remove the last row
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should support custom placeholders', () => {
    const onChange = vi.fn();
    render(
      <KeyValueEditor
        items={defaultItems}
        onChange={onChange}
        keyPlaceholder="Header"
        valuePlaceholder="Content"
      />
    );
    expect(screen.getByPlaceholderText('Header')).toBeDefined();
    expect(screen.getByPlaceholderText('Content')).toBeDefined();
  });
});
