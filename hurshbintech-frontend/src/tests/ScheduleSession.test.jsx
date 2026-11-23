import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import ScheduleSession from '../pages/head/ScheduleSession';

const mocks = vi.hoisted(() => ({
  create: vi.fn(), navigate: vi.fn(), error: vi.fn(), success: vi.fn(),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('react-toastify', () => ({ toast: { error: mocks.error, success: mocks.success } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 7, name: 'Trainer One' } }) }));
vi.mock('../api/services/sessionService', () => ({ default: { createSession: mocks.create } }));
vi.mock('../api/services/headService', () => ({ default: {
  getAllTrainers: async () => [{ id: 7, user_id: 7, name: 'Trainer One' }],
  getLearnersForSessionScheduling: async () => [{ id: 8, name: 'Learner One', can_schedule: true }],
} }));
vi.mock('../api/services/trainerService', () => ({ default: {
  getLearnersForScheduling: async () => [{ id: 8, name: 'Learner One', can_schedule: true }],
  getIlpPermission: async () => ({ can_trainers_schedule_ilp: true }),
} }));
vi.mock('../api/services/learningContentService', () => ({ default: {
  head: { getAll: async () => [] }, trainer: { getAll: async () => [] },
} }));
vi.mock('../api/services/learningGoalsService', () => ({ default: {
  head: { getAll: async () => [] }, trainer: { getAll: async () => [] },
} }));
vi.mock('../api/services/programService', () => ({ default: {
  getPrograms: async () => [], trainer: { getPrograms: async () => [] },
} }));
vi.mock('../utils/pdfGenerator', () => ({ downloadLearningProgramPDF: vi.fn() }));
vi.mock('react-datepicker', () => ({ default: ({ onChange }) => (
  <div>
    <button type="button" onClick={() => onChange(new Date(2030, 5, 15))}>Select today</button>
    <button type="button" onClick={() => onChange(new Date(2030, 5, 16))}>Select tomorrow</button>
  </div>
) }));

async function fillForm(mode = 'head') {
  render(<ScheduleSession mode={mode} />);
  await screen.findByPlaceholderText('Search learner by name or ID...');
  if (mode === 'head') {
    fireEvent.focus(screen.getByPlaceholderText('Search trainer by name or ID...'));
    fireEvent.click(screen.getByText('Trainer One'));
  }
  fireEvent.focus(screen.getByPlaceholderText('Search learner by name or ID...'));
  await act(async () => { fireEvent.click(screen.getByText('Learner One')); });
  fireEvent.change(screen.getByPlaceholderText('e.g., Introduction to Fruits'), { target: { value: 'Timed ILP' } });
  fireEvent.click(screen.getByText('Select today'));
}

function submit() {
  // Bypass browser validity to exercise the handler's own validation as well.
  fireEvent.submit(screen.getByRole('button', { name: 'Schedule ILP' }).closest('form'));
}

describe('ILP time slots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockReset().mockResolvedValue({ id: 1 });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2030, 5, 15, 12));
  });
  afterEach(() => vi.useRealTimers());

  it.each(['head', 'trainer'])('sends a future local start time and duration in %s mode', async (mode) => {
    await fillForm(mode);
    fireEvent.change(screen.getByLabelText(/Start Time/), { target: { value: '15:30' } });
    fireEvent.change(screen.getByLabelText(/Duration \(minutes\)/), { target: { value: '45' } });
    submit();
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      scheduled_date: '2030-06-15T15:30:00', duration: 45, trainer_id: 7, learner_id: 8,
    })));
    const payload = mocks.create.mock.calls[0][0];
    expect(payload).not.toHaveProperty('start_time');
    expect(payload).not.toHaveProperty('scheduled_dates');
    await waitFor(() => expect(mocks.success).toHaveBeenCalled());
  });

  it('requires a start time instead of silently scheduling midnight', async () => {
    await fillForm();
    expect(screen.getByLabelText(/Start Time/)).toBeRequired();
    submit();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith('Please fill in all required fields');
  });

  it('rejects a past time today before sending any sessions', async () => {
    await fillForm();
    fireEvent.click(screen.getByText('Select tomorrow'));
    fireEvent.change(screen.getByLabelText(/Start Time/), { target: { value: '11:00' } });
    submit();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith('Please choose a future start time for every selected date.');
  });

  it.each(['', '14', '241', '30.5'])('rejects invalid duration "%s"', async (duration) => {
    await fillForm();
    fireEvent.change(screen.getByLabelText(/Start Time/), { target: { value: '15:30' } });
    fireEvent.change(screen.getByLabelText(/Duration \(minutes\)/), { target: { value: duration } });
    submit();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith('Session duration must be between 15 and 240 minutes.');
  });

  it('applies the slot to multiple dates and retries only dates that failed', async () => {
    await fillForm();
    fireEvent.click(screen.getByText('Select tomorrow'));
    fireEvent.change(screen.getByLabelText(/Start Time/), { target: { value: '15:30' } });
    mocks.create.mockRejectedValueOnce(new Error('Request failed'));
    submit();
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('1 session(s) scheduled')));
    expect(mocks.create.mock.calls.map(([payload]) => payload.scheduled_date)).toEqual([
      '2030-06-15T15:30:00', '2030-06-16T15:30:00',
    ]);
    expect(mocks.create.mock.calls[0][0].duration).toBe(60);
    submit();
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(3));
    expect(mocks.create.mock.calls[2][0].scheduled_date).toBe('2030-06-15T15:30:00');
  });
});
