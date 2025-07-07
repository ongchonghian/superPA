
import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import type { Checklist, Task } from '@/lib/types';

// Define styles for the PDF document
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
  },
  header: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
  },
  taskWrapper: {
    marginBottom: 15,
    padding: 10,
    border: '1px solid #EEE',
    borderRadius: 5,
  },
  taskDescription: {
    fontSize: 14,
    marginBottom: 5,
    fontFamily: 'Helvetica-Bold',
  },
  taskDetails: {
    fontSize: 10,
    color: '#555',
    marginBottom: 8,
  },
  remarksContainer: {
    marginTop: 5,
    paddingLeft: 10,
    borderLeft: '1px solid #DDD',
  },
  remarksHeader: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  remarkText: {
    fontSize: 10,
    marginBottom: 2,
  }
});

interface ChecklistPdfDocumentProps {
  checklist: Checklist;
}

// This is the component that defines the PDF structure
export const ChecklistPdfDocument: React.FC<ChecklistPdfDocumentProps> = ({ checklist }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>{checklist.name}</Text>
      
      {checklist.tasks.map((task, index) => (
        // The `wrap={false}` prop is crucial. It tells the renderer to avoid 
        // splitting the content inside this View across pages if possible.
        <View key={index} style={styles.taskWrapper} wrap={false}>
          <Text style={styles.taskDescription}>
            {`[${task.status === 'complete' ? 'x' : ' '}] ${task.description}`}
          </Text>
          <Text style={styles.taskDetails}>
            {`Priority: ${task.priority} | Due: ${task.dueDate} | Assignee: ${task.assignee || 'Unassigned'}`}
          </Text>

          {task.remarks && task.remarks.length > 0 && (
            <View style={styles.remarksContainer}>
              <Text style={styles.remarksHeader}>Remarks:</Text>
              {task.remarks.map((remark, rIndex) => (
                <Text key={rIndex} style={styles.remarkText}>
                  - {remark.text} (by {remark.userId}, {new Date(remark.timestamp).toLocaleDateString()})
                </Text>
              ))}
            </View>
          )}
        </View>
      ))}
    </Page>
  </Document>
);
