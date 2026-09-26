import { AnswerSource } from '../enums/answer-source.enum';
import { Answer, AnswerRow } from '../interfaces/answer.interface';

export function toAnswer(r: AnswerRow): Answer {
  return {
    id: r.id,
    key: r.key,
    question: r.question,
    answer: r.answer,
    fieldType: r.field_type,
    source: r.source as AnswerSource,
    uses: r.uses,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
