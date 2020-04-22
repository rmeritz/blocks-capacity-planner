import React, {useCallback, useState} from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import Backend from 'react-dnd-html5-backend';
import {
	Box,
	Heading,
	Icon,
	ProgressBar,
} from '@airtable/blocks/ui';

import Rating from './rating';

import _assign from './assign';
import buildNullAssignments from './build-null-assignments';

const useAssignments = (consumers, producers) => {
	const [assignments, setAssignments] = useState(() => {
		return Object.freeze(producers.map((producer) => {
			return {
				consumerId: null,
				producerId: producer.id,
				amount: producer.capacity,
			};
		}));
	});
	const assign = useCallback(
		(fromConsumerId, toConsumerId, producerId) => {
			setAssignments(_assign(
				consumers,
				producers,
				assignments,
				fromConsumerId,
				toConsumerId,
				producerId
			));
		},
		[consumers, producers]
	);

	return [assignments, assign];
};

const useProducers = (_producers) => {
	const [producers, setProducers] = useState(
		() => Object.freeze(_producers.map((producer) => Object.freeze(Object.assign({}, producer, {assignment: null}))))
	);
	const assign = useCallback(
		(consumerId, producerId) => {
			setProducers(Object.freeze(producers.map((producer) => {
				return Object.freeze(Object.assign(
					{},
					producer,
					producer.id === producerId ? {assignment: consumerId} : null
				));
			})));
		},
		[producers]
	);

	return [producers, assign];
};

function ProducerDropZone({children, consumerId, producers, assignments, onAssign, accept, stat}) {
	const [, drop] = useDrop({
		accept,
		drop(item) {
			onAssign(item.id, consumerId);
		}
	});
	const items = assignments
		.filter((assignment) => assignment.consumerId === consumerId)
		.map((assignment) => (
			<AssignmentItem
				key={assignment.producerId}
				assignment={assignment}
				producer={producers.find(({id}) => id === assignment.producerId)}
				type={accept}
				stat={stat} />));

	return (
		<div ref={drop}>
			{children}

			<ul style={{listStyleType: 'none', margin: 0, padding: 0}}>
				{items}
			</ul>
		</div>
	);
}

function AssignmentItem({producer, assignment, type, stat}) {
	const [, drag] = useDrag({
		item: { id: assignment.id, type }
	});

	return (
		<li
			ref={drag}
			className="clearfix"
			style={{cursor: 'pointer', border: 'solid 1px #ddd', borderRadius: '0.4em', padding: '0.2em', margin: '0.2em'}}
			>
			<span style={{float: 'left'}}>{producer.name} ({assignment.amount}/{producer.capacity})</span>
			{stat ?
				<Rating
					style={{float: 'right', marginLeft: '1em'}}
					value={producer[stat]}
					min={producer[`min${stat}`]}
					max={producer[`max${stat}`]} />
				: ''}
		</li>
	);
}

function Consumer({
	consumer, producers, assignments, onAssign, accept, producerStat
}) {
	const provided = assignments.reduce((total, assignment) => {
		return total + assignment.amount;
	}, 0);
	const fulfillment = provided / consumer.need;
	let icon;

	if (fulfillment < 1) {
		icon = 'checkboxUnchecked';
	} else if (fulfillment === 1) {
		icon = 'checkboxChecked';
	} else {
		icon = 'warning';
	}

	return (
		<tr>
			<td width="50%">
				<ProducerDropZone
					consumerId={consumer.id}
					producers={producers}
					assignments={assignments}
					accept={accept}
					onAssign={onAssign}
					stat={producerStat}
					>
					<Heading as="h3" style={{fontSize: '1em'}}>{consumer.name}</Heading>
				</ProducerDropZone>
			</td>
			<td style={{width:'10%', textAlign: 'center'}}>
				{provided} / {consumer.need}
			</td>
			<td style={{width: 'calc(40% - 30px)'}}>
				<Box width={`${100*consumer.need/consumer.maxneed}%`}>
					<ProgressBar progress={fulfillment} barColor="#888" />
				</Box>
			</td>
			<td style={{width: '30px', textAlign: 'center'}}>
				<Icon name={icon} />
			</td>
		</tr>
	);
}

export default function ShiftView({shift, producers, consumers, producerStat, onAssign}) {
	const id = `${shift.date} ${shift.timeOfDay}`;
	const nullAssignments = buildNullAssignments(
		shift.date, shift.timeOfDay, producers, shift.assignments
	);
	const assign = (assignmentId, consumerId) => {
		const source = /^NullAssignment:/.test(assignmentId) ?
			nullAssignments : shift.assignments;
		const assignment = source.find(({id}) => id === assignmentId);

		// TODO(jugglinmike): Build a set of instructions describing table
		// operations and pass those along to the parent component.
		onAssign(assignment, consumerId);
	};

	return (
		<DndProvider backend={Backend}>
			<Heading as="h3" style={{borderBottom: '2px solid #bbb'}}>
				{id}
			</Heading>

			<Box marginBottom={4} style={{position: 'relative'}}>
				<Box style={{position: 'absolute', top: 0, bottom: 0, left: 0, width: '20%', overflowY: 'scroll'}}>
				<ProducerDropZone
					consumerId={null}
					producers={producers}
					assignments={nullAssignments}
					accept={id}
					onAssign={assign}
					stat={producerStat}
				>
					<Heading as="h3" style={{fontSize: '1em'}}>unassigned</Heading>
				</ProducerDropZone>
				</Box>

				<table style={{marginLeft: '20%', width: '80%', paddingLeft: '1em'}}>
					<tbody>
						{consumers.map((consumer) => (
							<Consumer
								key={consumer.id}
								consumer={consumer}
								producers={producers}
								assignments={shift.assignments.filter(({consumerId}) => consumerId === consumer.id)}
								accept={id}
								onAssign={assign}
								producerStat={producerStat} />
						))}
					</tbody>
				</table>
			</Box>
		</DndProvider>
	);
}