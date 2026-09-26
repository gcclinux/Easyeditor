import { useState } from 'react';
import useEscapeKey from '../utils/useEscapeKey';
import './autoGenerator.css';

interface GanttGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (ganttText: string) => void;
}

interface Task {
  id: number;
  name: string;
  startDate: string;
  section: string;
  duration: number;
  dependency?: string;
}

export const GanttGenerator: React.FC<GanttGeneratorProps> = ({ isOpen, onClose, onInsert }) => {
  useEscapeKey(onClose, isOpen);
  const [projectTitle, setProjectTitle] = useState('Project Schedule');
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, name: 'Task 1', startDate: '', section: '', duration: 3 }
  ]);

  const addTask = () => {
    const newTask = {
      id: tasks.length + 1,
      name: `Task ${tasks.length + 1}`,
      startDate: '',
      section: '',
      duration: 5
    };
    setTasks([...tasks, newTask]);
  };

  const updateTask = (index: number, field: keyof Task, value: string | number) => {
    const updatedTasks = tasks.map((task, i) => {
      if (i === index) {
        return { ...task, [field]: value };
      }
      return task;
    });
    setTasks(updatedTasks);
  };

  const createGanttChart = () => {
    let gantt = '```mermaid\ngantt\n';
    gantt += `    title ${projectTitle}\n`;
    gantt += '    section Initial\n';

    tasks.forEach((task) => {
      const taskId = `task${task.id}`;
      if (task.startDate !== '') {
        if (task.section !== '') {
          gantt += `    section ${task.section}\n`;
        }
      gantt += `    ${task.name} :${taskId}, ${task.startDate}, ${task.duration}d\n`;
      }
    });

    gantt += '```';
    return gantt;
  };

  return isOpen ? (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Gantt Chart Generator</h2>
        
        <div className="input-group">
          <input 
            className="project-title"
            type="text" 
            value={projectTitle} 
            onChange={e => setProjectTitle(e.target.value)}
          />
        </div>
        <div className="input-group">
          <div className='task-title'>
            <label>Task Name</label>
          </div>
          <div className='task-date'>
            <label>Start Date</label>
          </div>
          <div className='task-select'>
            <label>Section Name</label>
          </div>
          <div className='task-duration'>
            <label>&#8987; days</label>
          </div>
          <div className='task-dep'>
            <label>Task Dependency</label>
          </div>
        </div>

        {tasks.map((task, index) => (
          <div key={task.id} className="task-inputs">
            <input
              type="text"
              placeholder="Task name"
              value={task.name}
              onChange={e => updateTask(index, 'name', e.target.value)}
            />
            <input
              type="date"
              value={task.startDate}
              onChange={e => updateTask(index, 'startDate', e.target.value)}
            />
            <input
              type="text"
              placeholder="Section name"
              value={task.section}
              onChange={e => updateTask(index, 'section', e.target.value)}
            />
            <input
            className='input-days'
              type="number"
              min="1"
              placeholder="Duration (days)"
              value={task.duration}
              onChange={e => updateTask(index, 'duration', parseInt(e.target.value))}
            />
            <select
              value={task.dependency || ''}
              onChange={e => updateTask(index, 'dependency', e.target.value)}
            >
              <option value="">No dependency</option>
              {tasks.slice(0, index).map(t => (
                <option key={t.id} value={`task${t.id}`}>After {t.name}</option>
              ))}
            </select>
          </div>
        ))}

        <button onClick={addTask}>Add Task</button>
        <button onClick={() => onInsert(createGanttChart())}>Generate</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  ) : null;
};