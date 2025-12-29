import { getProducer } from '../config/kafka';
import { TOPICS, type JobCreatedEvent } from '../lib/types';

export async function produceJobCreated(event: JobCreatedEvent): Promise<void> {
  const producer = await getProducer();

  await producer.send({
    topic: TOPICS.JOB_CREATED,
    messages: [
      {
        key: event.jobId,
        value: JSON.stringify(event),
      },
    ],
  });

  console.log(`[Producer] Job created event sent: ${event.jobId}`);
}
