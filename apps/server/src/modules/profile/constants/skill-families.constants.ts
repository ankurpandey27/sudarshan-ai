// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

const SQL = ['mysql', 'mysql aurora', 'postgresql', 'sql server', 'mssql', 'oracle', 'sqlite', 'mariadb', 'rds'];
const NOSQL = ['mongodb', 'redis', 'dynamodb', 'cassandra', 'couchdb', 'firebase', 'elasticsearch', 'opensearch'];

/**
 * Skills whose years count towards a broader one you are asked about: "years of SQL?" counts your
 * MySQL and PostgreSQL, "Node.js" your NestJS and Express. Keys and members are canonical names.
 */
export const SKILL_FAMILIES: Record<string, string[]> = {
  sql: SQL,
  rdbms: SQL,
  nosql: NOSQL,
  database: [...SQL, ...NOSQL],
  databases: [...SQL, ...NOSQL],
  'node.js': ['nestjs', 'express.js', 'express'],
  'express.js': ['express'],
  express: ['express.js'],
  javascript: ['typescript', 'node.js', 'nestjs', 'express.js', 'express'],
  react: ['reactjs', 'react.js'],
  reactjs: ['react', 'react.js'],
  aws: ['s3', 'ec2', 'sqs', 'ses', 'sns', 'lambda', 'api gateway', 'cloudfront', 'msk', 'dynamodb', 'mysql aurora', 'rds'],
  gcp: ['gcs', 'google cloud platform', 'firebase'],
  cloud: ['aws', 'gcp', 'azure'],
};
