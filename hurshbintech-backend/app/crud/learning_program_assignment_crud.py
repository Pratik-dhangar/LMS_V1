from app.models.learning_goal_assignment_model import LearningGoalAssignment

def assign_programs(db, learner_id, program_ids, head_id):
    for pid in program_ids:
        exists = (
            db.query(LearningGoalAssignment)
              .filter_by(learner_id=learner_id, learning_goal_id=pid)
              .first()
        )
        if not exists:
            db.add(LearningGoalAssignment(
                learner_id=learner_id,
                learning_goal_id=pid,
                assigned_by_head=head_id,
            ))
    db.commit()
