import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.units import inch

def create_progress_report_pdf(project_data, report_content, filename):
    """Generate a PDF progress report"""
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=72
    )
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = styles['Heading1']
    subtitle_style = styles['Heading2']
    normal_style = styles['Normal']
    
    # Content
    story = []
    
    # Title
    story.append(Paragraph(f"Project Progress Report: {project_data['title']}", title_style))
    story.append(Spacer(1, 12))
    
    # Project Details
    story.append(Paragraph("Project Details", subtitle_style))
    story.append(Spacer(1, 12))
    
    project_info = [
        ["Project Name:", project_data['title']],
        ["Description:", project_data['description']],
        ["Deadline:", project_data['deadline']]
    ]
    
    t = Table(project_info, colWidths=[2*inch, 4*inch])
    t.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 20))
    
    # Report Content
    story.append(Paragraph("Progress Report", subtitle_style))
    story.append(Spacer(1, 12))
    
    # Split the report content into paragraphs
    paragraphs = report_content.split('\n\n')
    for para in paragraphs:
        if para.strip():
            story.append(Paragraph(para, normal_style))
            story.append(Spacer(1, 12))
    
    # Build the PDF
    doc.build(story)
    return filename

def create_roadmap_pdf(roadmap_data, filename):
    """Generate a PDF roadmap"""
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=72
    )
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = styles['Heading1']
    phase_style = styles['Heading2']
    task_style = styles['Heading3']
    normal_style = styles['Normal']
    
    # Content
    story = []
    
    # Title
    story.append(Paragraph("Project Roadmap", title_style))
    story.append(Spacer(1, 20))
    
    # Phases
    for phase in roadmap_data['phases']:
        story.append(Paragraph(phase['name'], phase_style))
        story.append(Paragraph(phase['description'], normal_style))
        story.append(Spacer(1, 12))
        
        # Tasks
        for task in phase['tasks']:
            story.append(Paragraph(task['title'], task_style))
            story.append(Paragraph(f"Description: {task['description']}", normal_style))
            story.append(Paragraph(f"Estimated Duration: {task['estimated_duration']}", normal_style))
            story.append(Spacer(1, 12))
        
        story.append(Spacer(1, 20))
    
    # Build the PDF
    doc.build(story)
    return filename 