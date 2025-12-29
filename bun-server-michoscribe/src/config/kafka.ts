import { Kafka, Producer, Consumer, Admin, logLevel } from 'kafkajs';
import { TOPICS } from '../lib/types';

const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9092';
const KAFKA_API_KEY = process.env.KAFKA_API_KEY;
const KAFKA_API_SECRET = process.env.KAFKA_API_SECRET;

const isConfluentCloud = KAFKA_API_KEY && KAFKA_API_SECRET;

export const kafka = new Kafka({
  clientId: 'michoscribe-server',
  brokers: KAFKA_BROKERS.split(','),
  logLevel: logLevel.WARN,
  ...(isConfluentCloud && {
    ssl: true,
    sasl: {
      mechanism: 'plain',
      username: KAFKA_API_KEY,
      password: KAFKA_API_SECRET,
    },
  }),
});

let producer: Producer | null = null;
let admin: Admin | null = null;

export async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = kafka.producer();
    await producer.connect();
    console.log('[Kafka] Producer connected');
  }
  return producer;
}

export async function createConsumer(groupId: string): Promise<Consumer> {
  const consumer = kafka.consumer({
    groupId,
    sessionTimeout: 30000,
    rebalanceTimeout: 60000,
  });
  await consumer.connect();
  console.log(`[Kafka] Consumer '${groupId}' connected`);
  return consumer;
}

export async function initializeTopics(): Promise<void> {
  if (!admin) {
    admin = kafka.admin();
    await admin.connect();
  }

  const existingTopics = await admin.listTopics();
  const topicsToCreate = Object.values(TOPICS).filter(
    (topic) => !existingTopics.includes(topic)
  );

  if (topicsToCreate.length > 0) {
    await admin.createTopics({
      topics: topicsToCreate.map((topic) => ({
        topic,
        numPartitions: 6,
        replicationFactor: isConfluentCloud ? 3 : 1,
      })),
    });
    console.log('[Kafka] Created topics:', topicsToCreate);
  } else {
    console.log('[Kafka] All topics already exist');
  }
}

export async function disconnectKafka(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
  if (admin) {
    await admin.disconnect();
    admin = null;
  }
  console.log('[Kafka] Disconnected');
}
