import { AnswerSource } from '../enums/answer-source.enum';

export interface Answer {
  id: number;
  key: string;
  question: string;
  answer: string;
  fieldType: string | null;
  source: AnswerSource;
  uses: number;
  createdAt: string;
  updatedAt: string;
}

export interface AnswerRow {
  id: number;
  key: string;
  question: string;
  answer: string;
  field_type: string | null;
  source: string;
  uses: number;
  created_at: string;
  updated_at: string;
}

export interface AnswerMatch {
  id: number;
  answer: string;
  source: AnswerSource;
  /** 1 for an exact key match. */
  similarity: number;
  question: string;
}
