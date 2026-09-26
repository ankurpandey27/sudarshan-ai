import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../common/storage/storage.service';
import { EventsService } from '../../common/events/events.service';
import { JobsService } from '../jobs/jobs.service';
import { LlmService } from '../llm/llm.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

describe('ProfileService.update', () => {
  const make = () => {
    const storage = new StorageService(':memory:');
    const events = new EventsService();
    const jobs = new JobsService(storage, events);
    const config = { getOrThrow: () => 'unused' } as unknown as ConfigService;
    return new ProfileService(storage, { isConfigured: () => false, isAvailable: () => false } as unknown as LlmService, events, jobs, config);
  };

  it('changes only the fields sent - absent (undefined) fields never erase stored data', () => {
    const svc = make();
    svc.update({ firstName: 'Priya', skills: [{ name: 'Node.js', years: 3 }], totalYearsExperience: 4 } as UpdateProfileDto);
    // Validated DTO instances carry every declared field, sent or not.
    svc.update({ firstName: undefined, skills: undefined, currentTitle: 'Backend Developer' } as UpdateProfileDto);
    expect(svc.get()).toMatchObject({
      firstName: 'Priya',
      currentTitle: 'Backend Developer',
      totalYearsExperience: 4,
      skills: [{ name: 'Node.js', years: 3 }],
    });
  });
});
